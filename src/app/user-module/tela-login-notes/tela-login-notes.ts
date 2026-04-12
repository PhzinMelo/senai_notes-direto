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

  // 👇 NOVO
  passwordVisible = false;

  constructor(private fb: FormBuilder, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme) {
      this.isDarkMode = savedTheme === 'dark';
    } else {
      this.isDarkMode = false;
      localStorage.setItem('theme', 'light');
    }

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

  // 👇 NOVO
  togglePassword(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  async onLoginClick(): Promise<void> {
    if (this.loginForm.invalid) {
      const emailVal = this.loginForm.get('email')?.value;
      const passVal = this.loginForm.get('password')?.value;
      this.emailErrorMessage = emailVal ? '' : 'O campo de e-mail é obrigatório.';
      this.passwordErrorMessage = passVal ? '' : 'O campo de senha é obrigatório.';
      return;
    }

    this.emailErrorMessage = '';
    this.passwordErrorMessage = '';
    this.sucessoErrorMessage = '';
    this.incorretoErrorMessage = '';

    const { email, password } = this.loginForm.value;

    try {
      const response = await fetch('https://backend-senainotes.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await response.json();
      if (response.ok) {
        const meuToken = json.data?.token;
        const meuId = json.data?.user?.id;

        localStorage.setItem('meuToken', meuToken ?? '');
        if (meuId) localStorage.setItem('meuId', meuId);

        this.sucessoErrorMessage = 'Login realizado com sucesso!';
        this.router.navigate(['/all-notes']);
      } else {
        this.incorretoErrorMessage = 'E-mail ou senha incorretos.';
      }
    } catch (err) {
      console.error(err);
      this.incorretoErrorMessage = 'Erro de conexão. Tente novamente.';
    }
  }

  goToRegister(): void {
    this.router.navigate(['/new-user-notes']);
  }
}