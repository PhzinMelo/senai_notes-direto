import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash, faBox, faPenToSquare, faHouse, faUser, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';

interface INote {
  idNota?: number;
  titulo: string;
  descricao: string;
  dataCriacao?: string;
  dataUpdate?: string;
  status: boolean;
  urlImg?: string;
  usuario?: {
    idUsuario: number;
    email: string;
  };
  notaTag?: Array<{
    id: {
      idAnotacao: number;
      idTag: number;
    };
    idAnotacao: string;
    idTag: {
      idTag: number;
      nomeTag: string;
    };
  }>;
}

interface INotaRequest {
  titulo: string;
  descricao: string;
  status: boolean;
  urlImg?: string;
  idUsuario: number;
  tags: string[];
}

interface INotaListagem {
  idNota: number;
  email: string;
  descricao: string;
  dataCriacao: string;
  dataUpdate: string;
  status: boolean;
  urlImg?: string;
  idUsuario: number;
  usuario: {
    id: number;
    email: string;
  };
  tag: Array<{
    idTag: number;
    nomeTag: string;
  }>;
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

  private baseUrl = 'http://senainotes-g3edp.us-east-1.elasticbeanstalk.com';

  notes: INotaListagem[] = [];
  notaSelecionada: INotaListagem | null = null;
  modoEdicao: boolean = false;
  modoCriacao: boolean = false;

  tituloControl = new FormControl("");
  conteudoControl = new FormControl("");
  tagsControl = new FormControl("");
  imagemUrlControl = new FormControl("");

  tagsFiltradas: string[] = [];
  termoBusca = new FormControl("");
  todasTags: string[] = [];
  viewMode: 'list' | 'archived' = 'list';
  darkMode: boolean = false;

  usuarioLogadoEmail: string = '';
  usuarioLogadoId: number = 0;

  // Separador para título e conteúdo
  private readonly separador = '\n\n--- CONTEÚDO ---\n\n';

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  ngOnInit() {
    this.carregarUsuarioLogado();
    this.getNotes();

    const darkModeLocalStorage = localStorage.getItem("darkMode");
    if (darkModeLocalStorage === "true") {
      this.darkMode = true;
      document.body.classList.toggle("dark-mode", this.darkMode);
    }
    console.log("🚀 Componente All Notes inicializado!");
    console.log("📡 API URL:", this.baseUrl);
  }

  private carregarUsuarioLogado() {
    const emailSalvo = localStorage.getItem("meuEmail");
    const idSalvo = localStorage.getItem("meuId");

    if (emailSalvo) {
      this.usuarioLogadoEmail = emailSalvo;
      console.log("👤 Email carregado:", this.usuarioLogadoEmail);
    } else {
      console.warn("⚠️ Nenhum email encontrado no localStorage");
    }

    if (idSalvo) {
      this.usuarioLogadoId = Number(idSalvo);
      console.log("🔑 ID carregado:", this.usuarioLogadoId);
    } else {
      console.warn("⚠️ Nenhum ID encontrado no localStorage");
    }
  }

  // Extrair título da descrição
  extrairTitulo(descricao: string): string {
    if (!descricao) return 'Sem título';

    if (descricao.includes(this.separador)) {
      return descricao.split(this.separador)[0].trim();
    }

    const primeiraLinha = descricao.split('\n')[0].trim();
    return primeiraLinha.length > 0
      ? (primeiraLinha.length > 60 ? primeiraLinha.substring(0, 60) + '...' : primeiraLinha)
      : 'Sem título';
  }

  // Extrair conteúdo da descrição
  extrairConteudo(descricao: string): string {
    if (!descricao) return '';

    if (descricao.includes(this.separador)) {
      const partes = descricao.split(this.separador);
      return partes.length > 1 ? partes[1].trim() : '';
    }

    const linhas = descricao.split('\n');
    return linhas.length > 1 ? linhas.slice(1).join('\n').trim() : '';
  }

  // Combinar título e conteúdo para salvar
  combinarTituloConteudo(titulo: string, conteudo: string): string {
    const tituloLimpo = titulo?.trim() || '';
    const conteudoLimpo = conteudo?.trim() || '';

    if (!tituloLimpo && !conteudoLimpo) return '';
    if (!conteudoLimpo) return tituloLimpo;
    if (!tituloLimpo) return conteudoLimpo;

    return `${tituloLimpo}${this.separador}${conteudoLimpo}`;
  }

  private getAuthHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + (localStorage.getItem("meuToken") || '')
    };
  }

  async getNotes() {
    try {
      console.log("📥 Buscando notas do email:", this.usuarioLogadoEmail);
      const url = `${this.baseUrl}/notes/nota/email/${this.usuarioLogadoEmail}`;
      const response = await firstValueFrom(
        this.http.get<INotaListagem[]>(url, { headers: this.getAuthHeaders() })
      );

      console.log("✅ Notas recebidas:", response);
      this.notes = this.viewMode === 'list'
        ? response.filter(note => note.status === true)
        : response.filter(note => note.status === false);

      this.extrairTodasTags();

      setTimeout(() => this.cd.detectChanges());
      
    } catch (error) {
      console.error("❌ Erro ao buscar notas:", error);
      alert("Não foi possível carregar as notas. Verifique se a API está disponível.");
    }
  }

  extrairTodasTags() {
    const tagsSet = new Set<string>();
    this.notes.forEach(note => note.tag?.forEach(tag => tagsSet.add(tag.nomeTag)));
    this.todasTags = Array.from(tagsSet).sort();
    console.log("🏷️ Tags disponíveis:", this.todasTags);
  }

  onNoteClick(nota: INotaListagem) {
    console.log("👆 Nota clicada:", nota);
    this.notaSelecionada = nota;
    this.modoEdicao = false;
    this.modoCriacao = false;

    // ✅ CORREÇÃO: Garantir que extraímos título e conteúdo corretamente
    const titulo = this.extrairTitulo(nota.descricao || '');
    const conteudo = this.extrairConteudo(nota.descricao || '');
    
    this.tituloControl.setValue(titulo);
    this.conteudoControl.setValue(conteudo);

    const tags = nota.tag?.map(t => t.nomeTag) || [];
    this.tagsControl.setValue(tags.join(", "));
    this.imagemUrlControl.setValue(nota.urlImg || "");

    setTimeout(() => this.cd.detectChanges());
  }

  criarNovaNota() {
    console.log("➕ Iniciando criação de nova nota...");
    this.modoCriacao = true;
    this.modoEdicao = false;
    this.notaSelecionada = null;

    this.tituloControl.setValue("");
    this.conteudoControl.setValue("");
    this.tagsControl.setValue("");
    this.imagemUrlControl.setValue("");
  }

  cancelar() {
    console.log("❌ Cancelando operação...");
    this.modoCriacao = false;
    this.modoEdicao = false;
    if (this.notaSelecionada) this.onNoteClick(this.notaSelecionada);
  }

  async salvarNota() {
    const titulo = this.tituloControl.value?.trim() || '';
    const conteudo = this.conteudoControl.value?.trim() || '';
    const tagsString = this.tagsControl.value?.trim() || '';
    const imagemUrl = this.imagemUrlControl.value?.trim() || '';

    if (!titulo && !conteudo) {
      alert("Título ou conteúdo são obrigatórios!");
      return;
    }

    const descricaoCompleta = this.combinarTituloConteudo(titulo, conteudo);
    const tags = tagsString ? tagsString.split(",").map(tag => tag.trim()).filter(tag => tag) : [];
    const headers = this.getAuthHeaders();

    try {
      if (this.modoCriacao) {
        console.log("💾 Criando nova nota...");
        const novaNota: INotaRequest = {
          titulo: titulo || "Nova Nota",
          descricao: descricaoCompleta,
          status: true,
          urlImg: imagemUrl,
          idUsuario: this.usuarioLogadoId,
          tags
        };

        console.log("📤 Dados a serem enviados:", novaNota);

        const url = `${this.baseUrl}/notes/nota`;
        const notaCriada = await firstValueFrom(this.http.post<INote>(url, novaNota, { headers }));

        console.log("✅ Nota criada com sucesso:", notaCriada);
        alert("Nota criada com sucesso!");

      } else if (this.notaSelecionada) {
        console.log("✏️ Atualizando nota ID:", this.notaSelecionada.idNota);
        const notaAtualizada: INotaRequest = {
          titulo: titulo || "Nota Atualizada",
          descricao: descricaoCompleta,
          status: true,
          urlImg: imagemUrl,
          idUsuario: this.usuarioLogadoId,
          tags
        };

        console.log("📤 Dados da atualização:", notaAtualizada);

        const url = `${this.baseUrl}/notes/nota/${this.notaSelecionada.idNota}`;
        const resposta = await firstValueFrom(this.http.put<INote>(url, notaAtualizada, { headers }));

        console.log("✅ Nota atualizada com sucesso:", resposta);
        alert("Nota atualizada com sucesso!");
      }

      // ✅ CORREÇÃO: Recarregar as notas e resetar estados
      await this.getNotes();
      this.modoCriacao = false;
      this.modoEdicao = false;
      this.notaSelecionada = null;

    } catch (error: any) {
      console.error("❌ Erro ao salvar nota:", error);
      
      // ✅ MELHOR TRATAMENTO DE ERRO
      if (error.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        this.logout();
      } else {
        alert(`Não foi possível salvar a nota. Erro: ${error.message || 'Desconhecido'}`);
      }
    }
  }

  async deletarNota() {
    if (!this.notaSelecionada || !this.notaSelecionada.idNota) {
      alert("Nenhuma nota selecionada para deletar!");
      return;
    }

    const descricao = this.notaSelecionada.descricao || '';
    const tituloNota = this.extrairTitulo(descricao);
    const confirmacao = confirm(`Tem certeza que deseja deletar a nota "${tituloNota}"?\nEsta ação não pode ser desfeita.`);

    if (!confirmacao) return;

    console.log("🗑️ Deletando nota ID:", this.notaSelecionada.idNota);
    const headers = this.getAuthHeaders();

    try {
      const url = `${this.baseUrl}/notes/nota/${this.notaSelecionada.idNota}`;
      await firstValueFrom(this.http.delete(url, { headers }));

      console.log("✅ Nota deletada com sucesso!");
      alert("Nota deletada com sucesso!");
      
      // ✅ CORREÇÃO: Resetar estados após deletar
      this.notaSelecionada = null;
      this.modoEdicao = false;
      await this.getNotes();

    } catch (error: any) {
      console.error("❌ Erro ao deletar nota:", error);
      
      if (error.status === 401) {
        alert("Sessão expirada. Faça login novamente.");
        this.logout();
      } else if (error.status === 404) {
        alert("Nota não encontrada. Ela pode já ter sido deletada.");
        await this.getNotes(); // Recarregar lista
      } else {
        alert(`Não foi possível deletar a nota. Erro: ${error.message || 'Desconhecido'}`);
      }
    }
  }

  // ✅ NOVO MÉTODO: Arquivar nota
  async arquivarNota() {
    if (!this.notaSelecionada || !this.notaSelecionada.idNota) {
      alert("Nenhuma nota selecionada para arquivar!");
      return;
    }

    const tituloNota = this.extrairTitulo(this.notaSelecionada.descricao || '');
    const confirmacao = confirm(`Deseja arquivar a nota "${tituloNota}"?`);

    if (!confirmacao) return;

    const headers = this.getAuthHeaders();

    try {
      const notaAtualizada: INotaRequest = {
        titulo: this.extrairTitulo(this.notaSelecionada.descricao || ''),
        descricao: this.notaSelecionada.descricao || '',
        status: false, // ✅ false = arquivada
        urlImg: this.notaSelecionada.urlImg || '',
        idUsuario: this.usuarioLogadoId,
        tags: this.notaSelecionada.tag?.map(t => t.nomeTag) || []
      };

      const url = `${this.baseUrl}/notes/nota/${this.notaSelecionada.idNota}`;
      await firstValueFrom(this.http.put<INote>(url, notaAtualizada, { headers }));

      console.log("📦 Nota arquivada com sucesso!");
      alert("Nota arquivada com sucesso!");
      
      this.notaSelecionada = null;
      await this.getNotes();

    } catch (error: any) {
      console.error("❌ Erro ao arquivar nota:", error);
      alert(`Não foi possível arquivar a nota. Erro: ${error.message || 'Desconhecido'}`);
    }
  }

  get notasFiltradas(): INotaListagem[] {
    let notas = this.notes;
    const termo = this.termoBusca.value?.toLowerCase() || '';
    if (termo) {
      notas = notas.filter(note => note.descricao?.toLowerCase().includes(termo) || note.tag?.some(tag => tag.nomeTag.toLowerCase().includes(termo)));
    }
    if (this.tagsFiltradas.length > 0) {
      notas = notas.filter(note => this.tagsFiltradas.every(tag => note.tag?.some(noteTag => noteTag.nomeTag === tag)));
    }
    return notas.sort((a, b) => new Date(b.dataUpdate).getTime() - new Date(a.dataUpdate).getTime());
  }

  toggleTagFilter(tag: string) {
    const index = this.tagsFiltradas.indexOf(tag);
    if (index > -1) this.tagsFiltradas.splice(index, 1);
    else this.tagsFiltradas.push(tag);
  }

  formatarData(data?: string): string {
    if (!data) return 'Sem data';
    return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  temImagem(nota: INotaListagem): boolean {
    return !!nota.urlImg && nota.urlImg.trim() !== '';
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'archived' : 'list';
    this.getNotes();
  }

  ligarDesligarDarkMode() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle("dark-mode", this.darkMode);
    localStorage.setItem("darkMode", this.darkMode.toString());
  }

  logout() {
    localStorage.removeItem("meuToken");
    localStorage.removeItem("meuId");
    localStorage.removeItem("meuEmail");
    window.location.href = "login";
  }
}