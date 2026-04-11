import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faTrash, faBox, faPenToSquare, faHouse, faUser, faMoon, faSun, faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons';
import { ImageCropperComponent } from 'ngx-image-cropper';
import type { CropperPosition, LoadedImage, Dimensions, ImageCroppedEvent } from 'ngx-image-cropper';
import { CropStylePipe } from './crop-style.pipe';

/**
 * ar = cropPixelWidth / cropPixelHeight
 *
 * Gravado no momento do crop. Permite que o container adote exatamente
 * o aspect-ratio do recorte via [style.aspect-ratio]="crop.ar",
 * tornando scaleX === scaleY no pipe (zero distorção).
 */
export interface INotaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  ar?: number;
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
  archived?: boolean;
}

interface ApiSuccess<T> { success: boolean; message: string; data: T; }

interface NoteCreatePayload {
  title: string;
  content: string;
  tags: string[];
  imageUrl?: string;
  crop?: INotaCrop;
}

interface NoteArchivePayload {
  archived: boolean;
}

/** Fallback para notas antigas sem ar salvo. */
const FALLBACK_AR = 2.35;

@Component({
  selector: 'app-all-notes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule, ImageCropperComponent, CropStylePipe],
  templateUrl: './all-notes.html',
  styleUrls: ['./all-notes.css'],
})
export class AllNotes {
  faTrash = faTrash; faBox = faBox; faPenToSquare = faPenToSquare;
  faHouse = faHouse; faUser = faUser; faMoon = faMoon; faSun = faSun;
  faMagnifyingGlass = faMagnifyingGlass;

  readonly fallbackAr = FALLBACK_AR;

  private readonly baseUrl = 'https://backend-senainotes.onrender.com';
  private readonly notesPath = '/api/notes';

  notas: INota[] = [];
  notaSelecionada: INota | null = null;
  modoEdicao = false;
  modoCriacao = false;

  tituloControl   = new FormControl('');
  conteudoControl = new FormControl('');
  tagsControl     = new FormControl('');
  imageUrlControl = new FormControl('');
  termoBusca      = new FormControl('');

  mostrarAnexoImagem  = false;
  cropPreviewImageUrl: string | null = null;
  draftCropPercent:   INotaCrop | null = null;
  imageUrlErroMsg = '';

  private loadedImageForCrop:  { width: number; height: number } | null = null;
  private cropperDisplayMax:   { width: number; height: number } | null = null;

  tagsFiltradas: string[] = [];
  todasTags: string[] = [];
  viewMode: 'list' | 'archived' = 'list';
  darkMode = false;
  usuarioLogadoId = localStorage.getItem('meuId') || '';

  // ── TOAST ──
  toastMessage = '';
  toastType: 'success' | 'error' | 'warning' = 'success';
  private toastTimer?: ReturnType<typeof setTimeout>;

  // ── MOBILE NAV STATES ──
  mobileSearchActive = false;
  mobileTagsActive   = false;

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  // ── TOAST ──────────────────────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.cd.detectChanges();
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.cd.detectChanges();
    }, 3000);
  }

  // ── MOBILE NAV ─────────────────────────────────────────────────────────────

  irParaLista(): void {
    this.viewMode = 'list';
    this.notaSelecionada = null;
    this.modoCriacao = false;
    this.modoEdicao = false;
    this.mobileSearchActive = false;
    this.mobileTagsActive   = false;
  }

  irParaArquivadas(): void {
    this.viewMode = 'archived';
    this.notaSelecionada = null;
    this.modoCriacao = false;
    this.modoEdicao = false;
    this.mobileSearchActive = false;
  }

  toggleMobileSearch(): void {
    this.mobileSearchActive = !this.mobileSearchActive;
    if (this.mobileSearchActive && !this.termoBusca.value)
      setTimeout(() => document.querySelector<HTMLInputElement>('.search-input')?.focus(), 100);
  }

  toggleMobileTags(): void {
    this.mobileTagsActive = !this.mobileTagsActive;
  }

  /** Fecha o painel de detalhe (botão "Back" no mobile). */
  fecharDetalhe(): void {
    this.notaSelecionada = null;
    this.modoCriacao = false;
    this.modoEdicao = false;
    this.resetAnexoState();
  }

  // ── API ────────────────────────────────────────────────────────────────────

  private notesEndpoint = () => `${this.baseUrl}${this.notesPath}`;

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('meuToken') || '';
    return new HttpHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
  }

  private mapApiToNota(raw: Record<string, unknown>): INota {
    const id = raw['_id'] ?? raw['id'];
    const cropRaw = raw['crop'] as Record<string, unknown> | null | undefined;
    let crop: INotaCrop | undefined;
    if (cropRaw && typeof cropRaw === 'object') {
      const x = Number(cropRaw['x']), y = Number(cropRaw['y']);
      const w = Number(cropRaw['width']), h = Number(cropRaw['height']);
      if ([x, y, w, h].every(Number.isFinite)) {
        crop = { x, y, width: w, height: h };
        const arRaw = Number(cropRaw['ar']);
        if (Number.isFinite(arRaw) && arRaw > 0) crop.ar = arRaw;
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
      archived: Boolean(raw['archived'] ?? false),
      dataEdicao: raw['updatedAt'] != null ? String(raw['updatedAt'])
                : raw['createdAt'] != null ? String(raw['createdAt']) : undefined,
    };
  }

  private clampPct(n: number, min = 0, max = 100): number {
    return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  }

  // ── IMAGEM / CROPPER ───────────────────────────────────────────────────────

  looksLikeImageUrl(url: string): boolean {
    try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
  }

  private verifyImageLoads(url: string): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      const done = (ok: boolean) => { clearTimeout(t); resolve(ok); };
      const t = window.setTimeout(() => done(false), 12000);
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  async onImageUrlBlur(): Promise<void> {
    const raw = this.imageUrlControl.value?.trim() || '';
    this.imageUrlErroMsg = '';
    this.loadedImageForCrop = null;
    if (!raw) { this.cropPreviewImageUrl = null; this.draftCropPercent = null; this.cd.detectChanges(); return; }
    if (!this.looksLikeImageUrl(raw)) {
      this.imageUrlErroMsg = 'Informe uma URL http ou https válida.';
      this.cropPreviewImageUrl = null; this.draftCropPercent = null; this.cd.detectChanges(); return;
    }
    const ok = await this.verifyImageLoads(raw);
    if (!ok) {
      this.imageUrlErroMsg = 'Não foi possível carregar esta URL como imagem.';
      this.cropPreviewImageUrl = null; this.draftCropPercent = null;
    } else {
      this.cropPreviewImageUrl = raw;
      if (!this.draftCropPercent)
        this.draftCropPercent = { x: 0, y: 0, width: 100, height: 100, ar: FALLBACK_AR };
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

  onCropperChange(event: CropperPosition): void {
    const dims = this.loadedImageForCrop;
    const max  = this.cropperDisplayMax;
    if (!dims?.width || !dims?.height || !max?.width) return;

    const ratio = dims.width / max.width;
    const x1 = Math.max(0,           Math.round(event.x1 * ratio));
    const y1 = Math.max(0,           Math.round(event.y1 * ratio));
    const x2 = Math.min(dims.width,  Math.round(event.x2 * ratio));
    const y2 = Math.min(dims.height, Math.round(event.y2 * ratio));
    const rw = x2 - x1, rh = y2 - y1;
    if (rw < 1 || rh < 1) return;

    this.draftCropPercent = {
      x:      this.clampPct((x1 / dims.width)  * 100),
      y:      this.clampPct((y1 / dims.height) * 100),
      width:  this.clampPct((rw / dims.width)  * 100, 1, 100),
      height: this.clampPct((rh / dims.height) * 100, 1, 100),
      ar:     Math.round((rw / rh) * 10000) / 10000,
    };
    this.cd.detectChanges();
  }

  onImageCroppedDiag(_ev: ImageCroppedEvent): void {}

  bannerAr(crop: INotaCrop | undefined): number {
    return crop?.ar ?? FALLBACK_AR;
  }

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (localStorage.getItem('darkmode') === 'true') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }
    void this.getNotas();
  }

  // ── NOTAS ──────────────────────────────────────────────────────────────────

  async getNotas(): Promise<void> {
    try {
      // Busca notas normais e arquivadas separadamente
      const [resNormais, resArquivadas] = await Promise.all([
        firstValueFrom(
          this.http.get<ApiSuccess<unknown[]>>(
            `${this.notesEndpoint()}?page=1&limit=100&archived=false`,
            { headers: this.getHeaders() },
          ),
        ),
        firstValueFrom(
          this.http.get<ApiSuccess<unknown[]>>(
            `${this.notesEndpoint()}?page=1&limit=100&archived=true`,
            { headers: this.getHeaders() },
          ),
        ),
      ]);

      const normais = (resNormais.success && Array.isArray(resNormais.data))
        ? resNormais.data.map(r => this.mapApiToNota(r as Record<string, unknown>))
            .filter(n => n.usuarioId === this.usuarioLogadoId)
            .map(n => ({ ...n, archived: false }))
        : [];

      const arquivadas = (resArquivadas.success && Array.isArray(resArquivadas.data))
        ? resArquivadas.data.map(r => this.mapApiToNota(r as Record<string, unknown>))
            .filter(n => n.usuarioId === this.usuarioLogadoId)
            .map(n => ({ ...n, archived: true }))
        : [];

      this.notas = [...normais, ...arquivadas];
      this.extrairTodasTags();
      this.cd.detectChanges();
    } catch (error) { console.error('Erro ao carregar notas:', error); }
  }

  extrairTodasTags(): void {
    const s = new Set<string>();
    this.notas.forEach(n => n.tags.forEach(t => s.add(t)));
    this.todasTags = Array.from(s).sort();
  }

  criarNovaNota(): void {
    this.modoCriacao = true; this.modoEdicao = false; this.notaSelecionada = null;
    this.tituloControl.setValue(''); this.conteudoControl.setValue('');
    this.tagsControl.setValue(''); this.imageUrlControl.setValue('');
    this.resetAnexoState(); this.mostrarAnexoImagem = false;
  }

  private resetAnexoState(): void {
    this.cropPreviewImageUrl = null; this.draftCropPercent = null;
    this.loadedImageForCrop = null; this.cropperDisplayMax = null;
    this.imageUrlErroMsg = '';
  }

  cancelar(): void {
    this.modoCriacao = false; this.modoEdicao = false;
    if (this.notaSelecionada) this.onNoteClick(this.notaSelecionada);
    else { this.resetAnexoState(); this.mostrarAnexoImagem = false; }
  }

  onNoteClick(nota: INota): void {
    this.notaSelecionada = nota;
    this.modoCriacao = false; this.modoEdicao = false;
    this.tituloControl.setValue(nota.titulo);
    this.conteudoControl.setValue(nota.descricao);
    this.tagsControl.setValue(nota.tags.join(', '));
    this.imageUrlControl.setValue(nota.imageUrl || '');
    this.resetAnexoState(); this.mostrarAnexoImagem = false;
    this.cd.detectChanges();
  }

  entrarModoEdicao(): void {
    this.modoEdicao = true;
    if (!this.notaSelecionada) return;
    this.mostrarAnexoImagem = !!(this.notaSelecionada.imageUrl);
    this.draftCropPercent = this.notaSelecionada.crop ? { ...this.notaSelecionada.crop } : null;
    this.cropPreviewImageUrl = this.notaSelecionada.imageUrl?.trim() || null;
    this.imageUrlErroMsg = ''; this.loadedImageForCrop = null; this.cropperDisplayMax = null;
  }

  revelarAnexoImagem(): void { this.mostrarAnexoImagem = true; }
  getDescricao(): string { return this.notaSelecionada?.descricao || ''; }

  async salvarNota(): Promise<void> {
    const titulo    = this.tituloControl.value?.trim() || '';
    const descricao = this.conteudoControl.value?.trim() || '';
    const tags = this.tagsControl.value?.split(',').map(t => t.trim().toLowerCase()).filter(t => t) || [];
    let imageUrl = this.imageUrlControl.value?.trim() || '';

    if (this.mostrarAnexoImagem && imageUrl && !this.cropPreviewImageUrl) {
      await this.onImageUrlBlur();
      imageUrl = this.imageUrlControl.value?.trim() || '';
    }
    if (!titulo || !descricao) { alert('Título e conteúdo são obrigatórios'); return; }

    let crop: INotaCrop | undefined;
    if (imageUrl) {
      crop = this.draftCropPercent ?? undefined;
      if (!crop && !this.modoCriacao && this.notaSelecionada?.crop)
        crop = { ...this.notaSelecionada.crop };
    }

    const payload: NoteCreatePayload = { title: titulo, content: descricao, tags };
    if (imageUrl) { payload.imageUrl = imageUrl; if (crop) payload.crop = crop; }

    try {
      if (this.modoCriacao) {
        await firstValueFrom(this.http.post<ApiSuccess<unknown>>(this.notesEndpoint(), payload, { headers: this.getHeaders() }));
        this.showToast('✓ Note created successfully!', 'success');
      } else if (this.notaSelecionada?.id) {
        await firstValueFrom(this.http.put<ApiSuccess<unknown>>(
          `${this.notesEndpoint()}/${this.notaSelecionada.id}`, payload, { headers: this.getHeaders() }));
        this.showToast('✓ Note saved successfully!', 'success');
      }
      this.modoCriacao = false; this.modoEdicao = false;
      this.notaSelecionada = null;
      await this.getNotas();
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      this.showToast('Failed to save note. Please try again.', 'error');
    }
  }

  async deletarNota(): Promise<void> {
    if (!this.notaSelecionada?.id) return;
    if (!confirm(`Deseja deletar a nota "${this.notaSelecionada.titulo}"?`)) return;
    try {
      await firstValueFrom(this.http.delete(`${this.notesEndpoint()}/${this.notaSelecionada.id}`, { headers: this.getHeaders() }));
      this.showToast('✓ Note deleted successfully!', 'success');
      this.notaSelecionada = null;
      await this.getNotas();
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
      this.showToast('Failed to delete note.', 'error');
    }
  }

  /**
   * BUG FIX: Arquiva/desarquiva a nota selecionada.
   * Envia PUT com { archived: true/false } para o backend.
   * A nota sai da lista atual e vai para a outra aba.
   */
async arquivarNota(): Promise<void> {
  if (!this.notaSelecionada?.id) return;

  const isCurrentlyArchived = this.notaSelecionada.archived === true;
  const confirmMsg = isCurrentlyArchived
    ? `Deseja restaurar a nota "${this.notaSelecionada.titulo}"?`
    : `Deseja arquivar a nota "${this.notaSelecionada.titulo}"?`;

  if (!confirm(confirmMsg)) return;

  try {
    // ✅ CORRETO: PATCH no endpoint de toggle — não envia body
    // O backend inverte o estado atual automaticamente
    await firstValueFrom(
      this.http.patch<ApiSuccess<unknown>>(
        `${this.notesEndpoint()}/${this.notaSelecionada.id}/archive`,
        {},                          // body vazio — o backend não precisa de nada
        { headers: this.getHeaders() }
      )
    );

    const msg = isCurrentlyArchived
      ? '✓ Note restored successfully!'
      : '✓ Note archived successfully!';

    this.showToast(msg, 'success');
    this.notaSelecionada = null;  // fecha o painel de detalhes
    await this.getNotas();        // recarrega as listas
  } catch (error) {
    console.error('Erro ao arquivar/restaurar nota:', error);
    this.showToast('Failed to archive/restore note.', 'error');
  }
}
  // ── FILTROS ────────────────────────────────────────────────────────────────

  get notasFiltradas(): INota[] {
    // Filtra por viewMode (archived vs normal)
    let notas = this.notas.filter(n =>
      this.viewMode === 'archived' ? n.archived === true : n.archived !== true
    );

    const termo = this.termoBusca.value?.toLowerCase();
    if (termo)
      notas = notas.filter(n =>
        n.titulo.toLowerCase().includes(termo) ||
        n.descricao.toLowerCase().includes(termo) ||
        n.tags.some(t => t.toLowerCase().includes(termo)));
    if (this.tagsFiltradas.length)
      notas = notas.filter(n => this.tagsFiltradas.every(tag => n.tags.includes(tag)));
    return notas.sort((a, b) => new Date(b.dataEdicao || '').getTime() - new Date(a.dataEdicao || '').getTime());
  }

  toggleTagFilter(tag: string): void {
    const i = this.tagsFiltradas.indexOf(tag);
    if (i > -1) this.tagsFiltradas.splice(i, 1); else this.tagsFiltradas.push(tag);
  }

  // ── UTILS ──────────────────────────────────────────────────────────────────

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
    localStorage.removeItem('meuToken'); localStorage.removeItem('meuId');
    window.location.href = 'login-screen';
  }
}