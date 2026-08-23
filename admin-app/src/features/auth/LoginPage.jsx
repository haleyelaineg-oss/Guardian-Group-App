import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError('Invalid email or password. Try again.');
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <img
            src="/assets/logo-color.png"
            alt="Guardian Group"
            className="login-logo-img"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="login-wordmark">GUARDIAN GROUP</div>
          <div className="login-sub">Client Portal</div>
        </div>
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field-group full">
            <label className="field-label" htmlFor="loginEmail">Email</label>
            <input
              type="email"
              id="loginEmail"
              className="field-input"
              placeholder="you@guardiangroup.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field-group full">
            <label className="field-label" htmlFor="loginPassword">Password</label>
            <input
              type="password"
              id="loginPassword"
              className="field-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="btn btn-primary login-btn">Sign In →</button>
        </form>
      </div>
    </div>
  );
}
