import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tela-login-notes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tela-login-notes.html',
  styleUrls: ['./tela-login-notes.css'],
  encapsulation: ViewEncapsulation.None,
})
export class TelaLoginNotes implements OnInit {
  loginForm: FormGroup;
  emailErrorMessage = '';
  passwordErrorMessage = '';
  sucessoErrorMessage = '';
  incorretoErrorMessage = '';
  isDarkMode = false;

  constructor(private fb: FormBuilder, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('theme');
    this.isDarkMode = savedTheme === 'dark';
    this.updateTheme();
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.updateTheme();
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  private updateTheme(): void {
    document.body.classList.toggle('dark-mode', this.isDarkMode);
  }

  async onLoginClick(): Promise<void> {
    // validação do form
    if (this.loginForm.invalid) {
      const emailVal = this.loginForm.get('email')?.value;
      const passVal = this.loginForm.get('password')?.value;
      this.emailErrorMessage = emailVal ? '' : 'O campo de e-mail é obrigatório.';
      this.passwordErrorMessage = passVal ? '' : 'O campo de senha é obrigatório.';
      return;
    }

    // limpa mensagens
    this.emailErrorMessage = '';
    this.passwordErrorMessage = '';
    this.sucessoErrorMessage = '';
    this.incorretoErrorMessage = '';

    const email = this.loginForm.get('email')?.value;
    const senha = this.loginForm.get('password')?.value;

    try {
      console.log('Tentando login com:', { email });

      const response = await fetch('http://senainotes-g3edp.us-east-1.elasticbeanstalk.com/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      console.log('Status da resposta (login):', response.status);

      if (response.ok) {
        const json = await response.json();
        console.log('Resposta do /api/auth:', json);

        // salva token, id e email no localStorage
        const token = json.token ?? json.accessToken ?? '';
        const usuario = json.usuario ?? json.user ?? null;
        const usuarioId = usuario?.id ?? usuario?.idUsuario ?? null;
        const usuarioEmail = usuario?.email ?? email;

        localStorage.setItem('meuToken', token);
        if (usuarioId != null) localStorage.setItem('meuId', String(usuarioId));
        if (usuarioEmail) localStorage.setItem('meuEmail', usuarioEmail);

        this.sucessoErrorMessage = 'Login realizado com sucesso!';
        console.log('Token salvo em localStorage (meuToken):', token);
        console.log('meuId / meuEmail salvos em localStorage:', usuarioId, usuarioEmail);

        // redireciona (pequeno delay para mostrar a mensagem)
        setTimeout(() => {
          this.router.navigate(['/all-notes']);
        }, 800);
      } else if (response.status === 401) {
        this.incorretoErrorMessage = 'E-mail ou senha incorretos (401).';
      } else if (response.status === 400) {
        this.incorretoErrorMessage = 'Requisição inválida (400).';
      } else {
        const text = await response.text();
        console.error('Erro inesperado no login:', response.status, text);
        this.incorretoErrorMessage = 'Erro inesperado no login. Veja o console.';
      }
    } catch (err) {
      console.error('Erro na requisição de login:', err);
      this.incorretoErrorMessage = 'Erro de conexão. Verifique sua internet.';
    }
  }

  goToRegister(): void {
    this.router.navigate(['/new-user-notes']);
  }
}
