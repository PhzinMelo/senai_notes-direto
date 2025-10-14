import { Component, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash, faBox, faPenToSquare, faHouse, faUser, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

interface INota {
  id?: string;
  titulo: string;
  descricao: string;
  usuarioId: string;
  tags: string[];
  imagemUrl?: string;
  dataEdicao?: string;
}

@Component({
  selector: 'app-all-notes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './all-notes.html',
  styleUrls: ['./all-notes.css']
})
export class AllNotes {
  faTrash = faTrash;
  faBox = faBox;
  faPenToSquare = faPenToSquare;
  faHouse = faHouse;
  faUser = faUser;
  faMoon = faMoon;
  faSun = faSun;

  private baseUrl = 'https://senai-gpt-api.azurewebsites.net';
  private grupo = 3; // Grupo do usuário

  notas: INota[] = [];
  notaSelecionada: INota | null = null;

  modoEdicao = false;
  modoCriacao = false;

  tituloControl = new FormControl('');
  conteudoControl = new FormControl('');
  tagsControl = new FormControl('');
  imagemUrlControl = new FormControl('');
  termoBusca = new FormControl('');

  tagsFiltradas: string[] = [];
  todasTags: string[] = [];
  viewMode: 'list' | 'archived' = 'list';
  darkMode = false;
  usuarioLogadoId = localStorage.getItem("meuId") || "";

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  // ================= HEADERS =================
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('meuToken') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ================= INIT =================
  ngOnInit() {
    if (localStorage.getItem('darkmode') === 'true') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }
    this.getNotas();
  }

  // ================= GET NOTAS =================
  async getNotas() {
    try {
      const url = `${this.baseUrl}/senainotes/notesg${this.grupo}`;
      const response = await firstValueFrom(this.http.get<INota[]>(url, { headers: this.getHeaders() }));
      this.notas = response.filter(n => n.usuarioId === this.usuarioLogadoId);
      this.extrairTodasTags();
      this.cd.detectChanges();
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    }
  }

  extrairTodasTags() {
    const setTags = new Set<string>();
    this.notas.forEach(n => n.tags.forEach(t => setTags.add(t)));
    this.todasTags = Array.from(setTags).sort();
  }

  // ================= CRIAÇÃO/EDIÇÃO =================
  criarNovaNota() {
    this.modoCriacao = true;
    this.modoEdicao = false;
    this.notaSelecionada = null;

    this.tituloControl.setValue('');
    this.conteudoControl.setValue('');
    this.tagsControl.setValue('');
    this.imagemUrlControl.setValue('');
  }

  cancelar() {
    this.modoCriacao = false;
    this.modoEdicao = false;
    if (this.notaSelecionada) this.onNoteClick(this.notaSelecionada);
  }

  onNoteClick(nota: INota) {
    this.notaSelecionada = nota;
    this.modoCriacao = false;
    this.modoEdicao = false;

    this.tituloControl.setValue(nota.titulo);
    this.conteudoControl.setValue(nota.descricao);
    this.tagsControl.setValue(nota.tags.join(', '));
    this.imagemUrlControl.setValue(nota.imagemUrl || '');
    this.cd.detectChanges();
  }

  getDescricao(): string {
    return this.notaSelecionada?.descricao || '';
  }

  // ================= SALVAR NOTA =================
  async salvarNota() {
    const titulo = this.tituloControl.value?.trim() || '';
    const descricao = this.conteudoControl.value?.trim() || '';
    const tags = this.tagsControl.value?.split(',').map(t => t.trim()).filter(t => t) || [];
    const imagemUrl = this.imagemUrlControl.value?.trim() || '';

    if (!titulo || !descricao) {
      alert('Título e conteúdo são obrigatórios');
      return;
    }

    const payload: INota = {
      titulo,
      descricao,
      tags,
      usuarioId: this.usuarioLogadoId,
      imagemUrl,
      dataEdicao: new Date().toISOString()
    };

    try {
      if (this.modoCriacao) {
        await firstValueFrom(this.http.post(`${this.baseUrl}/senainotes/notesg${this.grupo}`, payload, { headers: this.getHeaders() }));
      } else if (this.notaSelecionada?.id) {
        await firstValueFrom(this.http.put(`${this.baseUrl}/senainotes/notesg${this.grupo}/${this.notaSelecionada.id}`, payload, { headers: this.getHeaders() }));
      }

      this.modoCriacao = false;
      this.modoEdicao = false;
      await this.getNotas();
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      alert('Não foi possível salvar a nota.');
    }
  }

  // ================= DELETAR NOTA =================
  async deletarNota() {
    if (!this.notaSelecionada?.id) return;
    if (!confirm(`Deseja deletar a nota "${this.notaSelecionada.titulo}"?`)) return;

    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/senainotes/notesg${this.grupo}/${this.notaSelecionada.id}`, { headers: this.getHeaders() }));
      this.notaSelecionada = null;
      await this.getNotas();
    } catch (error) {
      console.error('Erro ao deletar nota:', error);
    }
  }

  // ================= FILTROS =================
  get notasFiltradas() {
    let notas = this.notas;
    const termo = this.termoBusca.value?.toLowerCase();
    if (termo) {
      notas = notas.filter(n =>
        n.titulo.toLowerCase().includes(termo) ||
        n.descricao.toLowerCase().includes(termo) ||
        n.tags.some(t => t.toLowerCase().includes(termo))
      );
    }
    if (this.tagsFiltradas.length) {
      notas = notas.filter(n => this.tagsFiltradas.every(tag => n.tags.includes(tag)));
    }
    return notas.sort((a, b) => new Date(b.dataEdicao || '').getTime() - new Date(a.dataEdicao || '').getTime());
  }

  toggleTagFilter(tag: string) {
    const index = this.tagsFiltradas.indexOf(tag);
    if (index > -1) this.tagsFiltradas.splice(index, 1);
    else this.tagsFiltradas.push(tag);
  }

  formatarData(data?: string) {
    if (!data) return '';
    return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  ligarDesligarDarkMode() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark-mode', this.darkMode);
    localStorage.setItem('darkmode', this.darkMode.toString());
  }

  logout() {
    localStorage.removeItem('meuToken');
    localStorage.removeItem('meuId');
    window.location.href = 'login-screen';
  }
}
