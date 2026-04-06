import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash, faBox, faPenToSquare, faHouse, faUser, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { ImageCropperComponent } from 'ngx-image-cropper';
import type { CropperPosition, LoadedImage, Dimensions, ImageCroppedEvent } from 'ngx-image-cropper';

/** Percent crop (0–100), same contract as notes-api (mongoose + zod). */
export interface INotaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface INota {
  id?: string;
  titulo: string;
  descricao: string;
  usuarioId: string;
  tags: string[];
  imageUrl?: string;
  crop?: INotaCrop;
  dataEdicao?: string;
}

interface ApiSuccess<T> {
  success: boolean;
  message: string;
  data: T;
}

interface NoteCreatePayload {
  title: string;
  content: string;
  tags: string[];
  imageUrl?: string;
  crop?: INotaCrop;
}

/** Diagnóstico em tempo real: imagem real vs overlay na tela, % persistidas e referência da lib. */
interface IDebugInfo {
  /** Coordenadas do recorte em pixels no espaço da imagem transformada (após ratio). */
  raw?: CropperPosition;
  /** Coordenadas na escala do cropper na tela (maxSize). */
  screenCrop?: CropperPosition;
  /** Resolução da imagem usada no cálculo (transformed.size). */
  imageSize?: { width: number; height: number };
  /** Área exibida do componente (cropperReady). */
  maxSize?: { width: number; height: number };
  /** transformed.width / maxSize.width — igual ao CropService.getRatio. */
  ratio?: number;
  /** Porcentagens 0–100 enviadas ao back-end. */
  calculated?: INotaCrop;
  /** imagePosition do canvas interno (ngx-image-cropper) para cruzar com `raw`. */
  libraryRaw?: CropperPosition;
  note?: string;
}

@Component({
  selector: 'app-all-notes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule, ImageCropperComponent],
  templateUrl: './all-notes.html',
  styleUrls: ['./all-notes.css'],
})
export class AllNotes {
  faTrash = faTrash;
  faBox = faBox;
  faPenToSquare = faPenToSquare;
  faHouse = faHouse;
  faUser = faUser;
  faMoon = faMoon;
  faSun = faSun;

  /** Local API host (notes routes are mounted under /api/notes in notes-api). */
  private readonly baseUrl = 'https://backend-senainotes.onrender.com';
  private readonly notesPath = '/api/notes';

  notas: INota[] = [];
  notaSelecionada: INota | null = null;

  modoEdicao = false;
  modoCriacao = false;

  tituloControl = new FormControl('');
  conteudoControl = new FormControl('');
  tagsControl = new FormControl('');
  imageUrlControl = new FormControl('');
  termoBusca = new FormControl('');

  /** Reveals URL field + cropper after "Anexar Imagem". */
  mostrarAnexoImagem = false;
  cropPreviewImageUrl: string | null = null;
  draftCropPercent: INotaCrop | null = null;
  imageUrlErroMsg = '';

  /** Diagnóstico em tempo real do recorte (modo criar/editar). */
  debugInfo: IDebugInfo = {};

  private loadedImageForCrop: { width: number; height: number } | null = null;
  /** Tamanho exibido do cropper (overlay), igual a `maxSize` interno da lib — necessário para o ratio. */
  private cropperDisplayMax: { width: number; height: number } | null = null;

  tagsFiltradas: string[] = [];
  todasTags: string[] = [];
  viewMode: 'list' | 'archived' = 'list';
  darkMode = false;
  usuarioLogadoId = localStorage.getItem('meuId') || '';

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
  ) {}

  private notesEndpoint(): string {
    return `${this.baseUrl}${this.notesPath}`;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('meuToken') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  private mapApiToNota(raw: Record<string, unknown>): INota {
    const id = raw['_id'] ?? raw['id'];
    const cropRaw = raw['crop'] as Record<string, unknown> | null | undefined;
    let crop: INotaCrop | undefined;
    if (cropRaw && typeof cropRaw === 'object') {
      const x = Number(cropRaw['x']);
      const y = Number(cropRaw['y']);
      const w = Number(cropRaw['width']);
      const h = Number(cropRaw['height']);
      if ([x, y, w, h].every(n => Number.isFinite(n))) {
        crop = { x, y, width: w, height: h };
      }
    }
    return {
      id: id != null ? String(id) : undefined,
      titulo: String(raw['title'] ?? ''),
      descricao: String(raw['content'] ?? ''),
      usuarioId: String(raw['userId'] ?? ''),
      tags: Array.isArray(raw['tags']) ? (raw['tags'] as string[]) : [],
      imageUrl: raw['imageUrl'] != null && String(raw['imageUrl']).trim() ? String(raw['imageUrl']).trim() : undefined,
      crop,
      dataEdicao:
        raw['updatedAt'] != null
          ? String(raw['updatedAt'])
          : raw['createdAt'] != null
            ? String(raw['createdAt'])
            : undefined,
    };
  }

  private clampPct(n: number, min = 0, max = 100): number {
    const r = Math.round(n * 100) / 100;
    return Math.min(max, Math.max(min, r));
  }

  looksLikeImageUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private verifyImageLoads(url: string): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      const done = (ok: boolean) => {
        clearTimeout(t);
        resolve(ok);
      };
      const t = window.setTimeout(() => done(false), 12000);
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = url;
    });
  }

  async onImageUrlBlur(): Promise<void> {
    const raw = this.imageUrlControl.value?.trim() || '';
    this.imageUrlErroMsg = '';
    this.loadedImageForCrop = null;
    if (!raw) {
      this.cropPreviewImageUrl = null;
      this.draftCropPercent = null;
      this.cd.detectChanges();
      return;
    }
    if (!this.looksLikeImageUrl(raw)) {
      this.imageUrlErroMsg = 'Informe uma URL http ou https válida.';
      this.cropPreviewImageUrl = null;
      this.draftCropPercent = null;
      this.cd.detectChanges();
      return;
    }
    const ok = await this.verifyImageLoads(raw);
    if (!ok) {
      this.imageUrlErroMsg = 'Não foi possível carregar esta URL como imagem.';
      this.cropPreviewImageUrl = null;
      this.draftCropPercent = null;
    } else {
      this.cropPreviewImageUrl = raw;
    }
    this.cd.detectChanges();
  }

  onImageUrlPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text')?.trim();
    if (!text || !this.looksLikeImageUrl(text)) return;
    event.preventDefault();
    this.imageUrlControl.setValue(text);
    void this.onImageUrlBlur();
  }

  onCropImageLoaded(img: LoadedImage): void {
    const { width, height } = img.transformed.size;
    this.loadedImageForCrop = { width, height };
    this.cropperDisplayMax = null;
  }

  onCropperReady(dim: Dimensions): void {
    this.cropperDisplayMax = { width: dim.width, height: dim.height };
  }

  /**
   * `cropperChange` entrega coordenadas na escala da **área exibida** (maxSize), não da imagem.
   * Mesma lógica de `CropService.getImagePosition`: ratio = transformed.width / maxSize.width.
   */
  onCropperChange(event: CropperPosition): void {
    const dims = this.loadedImageForCrop;
    const max = this.cropperDisplayMax;
    if (!dims?.width || !dims?.height || !max?.width) {
      const partial: IDebugInfo = {
        screenCrop: event,
        imageSize: dims ?? undefined,
        note: 'Aguardando dimensões (imageLoaded / cropperReady).',
      };
      this.debugInfo = { ...this.debugInfo, ...partial };
      this.cd.detectChanges();
      return;
    }

    const ratio = dims.width / max.width;
    const raw: CropperPosition = {
      x1: Math.round(event.x1 * ratio),
      y1: Math.round(event.y1 * ratio),
      x2: Math.round(event.x2 * ratio),
      y2: Math.round(event.y2 * ratio),
    };
    raw.x1 = Math.max(0, raw.x1);
    raw.y1 = Math.max(0, raw.y1);
    raw.x2 = Math.min(dims.width, raw.x2);
    raw.y2 = Math.min(dims.height, raw.y2);

    const rw = raw.x2 - raw.x1;
    const rh = raw.y2 - raw.y1;
    if (rw < 1 || rh < 1) {
      this.cd.detectChanges();
      return;
    }

    this.draftCropPercent = {
      x: this.clampPct((raw.x1 / dims.width) * 100),
      y: this.clampPct((raw.y1 / dims.height) * 100),
      width: this.clampPct((rw / dims.width) * 100, 1, 100),
      height: this.clampPct((rh / dims.height) * 100, 1, 100),
    };

    const next: IDebugInfo = {
      raw,
      screenCrop: event,
      ratio,
      imageSize: { width: dims.width, height: dims.height },
      maxSize: { width: max.width, height: max.height },
      calculated: { ...this.draftCropPercent },
    };
    this.debugInfo = next;
    this.cd.detectChanges();
  }

  /** Confere com o `imagePosition` emitido pelo canvas interno (referência da lib). */
  onImageCroppedDiag(ev: ImageCroppedEvent): void {
    const ip = ev.imagePosition;
    this.debugInfo = {
      ...this.debugInfo,
      libraryRaw: { x1: ip.x1, y1: ip.y1, x2: ip.x2, y2: ip.y2 },
    };
    this.cd.detectChanges();
  }

  /**
   * Escala inversa: scale = 100 / crop.width (e height); imagem preenche o frame com o mesmo recorte %.
   */
  thumbCropStyle(c: INotaCrop): Record<string, string> {
    const { x, y, width, height } = c;
    if (width <= 0 || height <= 0) return {};
    const scaleX = 100 / width;
    const scaleY = 100 / height;
    return {
      position: 'absolute',
      width: `${scaleX * 100}%`,
      height: `${scaleY * 100}%`,
      left: `${-x * scaleX}%`,
      top: `${-y * scaleY}%`,
      objectFit: 'fill',
    };
  }

  ngOnInit(): void {
    if (localStorage.getItem('darkmode') === 'true') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }
    void this.getNotas();
  }

  async getNotas(): Promise<void> {
    try {
      const url = `${this.notesEndpoint()}?page=1&limit=100&archived=false`;
      const response = await firstValueFrom(
        this.http.get<ApiSuccess<unknown[]>>(url, { headers: this.getHeaders() }),
      );
      if (!response.success || !Array.isArray(response.data)) {
        console.error('Resposta de notas inválida:', response);
        return;
      }
      this.notas = response.data.map(r => this.mapApiToNota(r as Record<string, unknown>)).filter(n => n.usuarioId === this.usuarioLogadoId);
      this.extrairTodasTags();
      this.cd.detectChanges();
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    }
  }

  extrairTodasTags(): void {
    const setTags = new Set<string>();
    this.notas.forEach(n => n.tags.forEach(t => setTags.add(t)));
    this.todasTags = Array.from(setTags).sort();
  }

  criarNovaNota(): void {
    this.modoCriacao = true;
    this.modoEdicao = false;
    this.notaSelecionada = null;

    this.tituloControl.setValue('');
    this.conteudoControl.setValue('');
    this.tagsControl.setValue('');
    this.imageUrlControl.setValue('');
    this.resetAnexoState();
    this.mostrarAnexoImagem = false;
  }

  private resetAnexoState(): void {
    this.cropPreviewImageUrl = null;
    this.draftCropPercent = null;
    this.loadedImageForCrop = null;
    this.cropperDisplayMax = null;
    this.imageUrlErroMsg = '';
    this.debugInfo = {};
  }

  cancelar(): void {
    this.modoCriacao = false;
    this.modoEdicao = false;
    if (this.notaSelecionada) this.onNoteClick(this.notaSelecionada);
    else {
      this.resetAnexoState();
      this.mostrarAnexoImagem = false;
    }
  }

  onNoteClick(nota: INota): void {
    this.notaSelecionada = nota;
    this.modoCriacao = false;
    this.modoEdicao = false;

    this.tituloControl.setValue(nota.titulo);
    this.conteudoControl.setValue(nota.descricao);
    this.tagsControl.setValue(nota.tags.join(', '));
    this.imageUrlControl.setValue(nota.imageUrl || '');
    this.resetAnexoState();
    this.mostrarAnexoImagem = false;
    this.cd.detectChanges();
  }

  entrarModoEdicao(): void {
    this.modoEdicao = true;
    if (!this.notaSelecionada) return;
    this.mostrarAnexoImagem = !!(this.notaSelecionada.imageUrl);
    this.draftCropPercent = this.notaSelecionada.crop ? { ...this.notaSelecionada.crop } : null;
    this.cropPreviewImageUrl = this.notaSelecionada.imageUrl?.trim() || null;
    this.imageUrlErroMsg = '';
    this.loadedImageForCrop = null;
    this.cropperDisplayMax = null;
    this.debugInfo = {};
  }

  revelarAnexoImagem(): void {
    this.mostrarAnexoImagem = true;
  }

  getDescricao(): string {
    return this.notaSelecionada?.descricao || '';
  }

  async salvarNota(): Promise<void> {
    const titulo = this.tituloControl.value?.trim() || '';
    const descricao = this.conteudoControl.value?.trim() || '';
    const tags =
      this.tagsControl.value
        ?.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t) || [];
    let imageUrl = this.imageUrlControl.value?.trim() || '';

    if (this.mostrarAnexoImagem && imageUrl && !this.cropPreviewImageUrl) {
      await this.onImageUrlBlur();
      imageUrl = this.imageUrlControl.value?.trim() || '';
    }

    if (!titulo || !descricao) {
      alert('Título e conteúdo são obrigatórios');
      return;
    }

    let crop: INotaCrop | undefined;
    if (imageUrl) {
      crop = this.draftCropPercent ?? undefined;
      if (!crop && !this.modoCriacao && this.notaSelecionada?.crop) {
        crop = { ...this.notaSelecionada.crop };
      }
    }

    const payload: NoteCreatePayload = {
      title: titulo,
      content: descricao,
      tags,
    };
    if (imageUrl) {
      payload.imageUrl = imageUrl;
      if (crop) payload.crop = crop;
    }

    try {
      if (this.modoCriacao) {
        await firstValueFrom(
          this.http.post<ApiSuccess<unknown>>(this.notesEndpoint(), payload, { headers: this.getHeaders() }),
        );
      } else if (this.notaSelecionada?.id) {
        await firstValueFrom(
          this.http.put<ApiSuccess<unknown>>(
            `${this.notesEndpoint()}/${this.notaSelecionada.id}`,
            payload,
            { headers: this.getHeaders() },
          ),
        );
      }

      this.modoCriacao = false;
      this.modoEdicao = false;
      await this.getNotas();
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      alert('Não foi possível salvar a nota.');
    }
  }

  async deletarNota(): Promise<void> {
    if (!this.notaSelecionada?.id) return;
    if (!confirm(`Deseja deletar a nota "${this.notaSelecionada.titulo}"?`)) return;

    try {
      await firstValueFrom(
        this.http.delete(`${this.notesEndpoint()}/${this.notaSelecionada.id}`, { headers: this.getHeaders() }),
      );
      this.notaSelecionada = null;
      await this.getNotas();
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
    }
  }

  get notasFiltradas(): INota[] {
    let notas = this.notas;
    const termo = this.termoBusca.value?.toLowerCase();
    if (termo) {
      notas = notas.filter(
        n =>
          n.titulo.toLowerCase().includes(termo) ||
          n.descricao.toLowerCase().includes(termo) ||
          n.tags.some(t => t.toLowerCase().includes(termo)),
      );
    }
    if (this.tagsFiltradas.length) {
      notas = notas.filter(n => this.tagsFiltradas.every(tag => n.tags.includes(tag)));
    }
    return notas.sort((a, b) => new Date(b.dataEdicao || '').getTime() - new Date(a.dataEdicao || '').getTime());
  }

  toggleTagFilter(tag: string): void {
    const index = this.tagsFiltradas.indexOf(tag);
    if (index > -1) this.tagsFiltradas.splice(index, 1);
    else this.tagsFiltradas.push(tag);
  }

  formatarData(data?: string): string {
    if (!data) return '';
    return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  ligarDesligarDarkMode(): void {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark-mode', this.darkMode);
    localStorage.setItem('darkmode', this.darkMode.toString());
  }

  logout(): void {
    localStorage.removeItem('meuToken');
    localStorage.removeItem('meuId');
    window.location.href = 'login-screen';
  }
}
