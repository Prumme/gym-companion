import { Navigate } from 'react-router-dom';

/** Conservé pour rétrocompat : la bottom nav pointe déjà vers `/progress` (overview). */
export function ProgressHubPage() {
  return <Navigate to="/progress" replace />;
}
