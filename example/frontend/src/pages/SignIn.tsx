import { Link, useNavigate } from 'react-router-dom';
import { LoginForm } from '@readysetcloud/ui/auth';

export default function SignIn() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <LoginForm
        onSuccess={() => navigate('/')}
        signUpPrompt={
          <span className="text-sm text-muted-foreground">
            New here? <Link className="btn-link" to="/signup">Create an account</Link>
          </span>
        }
      />
    </div>
  );
}
