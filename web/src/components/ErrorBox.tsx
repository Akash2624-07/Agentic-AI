import { ApiError } from '../api/client';

export function ErrorBox({ error, what }: { error: unknown; what?: string }) {
  const message = error instanceof ApiError || error instanceof Error ? error.message : String(error);
  return (
    <div className="err-box" role="alert">
      <strong>{what ? `Couldn't load ${what}.` : 'Something went wrong.'}</strong> {message}
    </div>
  );
}
