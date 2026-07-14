import { Link, useNavigate } from 'react-router-dom';
import { SignUpForm } from '@readysetcloud/ui/auth';

export default function SignUp() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full items-center justify-center p-6">
      <SignUpForm
        onSuccess={() => navigate('/signin')}
        signInPrompt={
          <span className="text-sm text-muted-foreground">
            Already have an account? <Link className="btn-link" to="/signin">Sign in</Link>
          </span>
        }
      />
    </div>
  );
}
