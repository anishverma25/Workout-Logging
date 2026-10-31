import { Navigate, useLocation } from 'react-router';

/** The old methodology address now opens the science page, keeping any #section. */
export function MethodologyRedirect() {
  const { hash } = useLocation();
  return <Navigate to={{ pathname: '/science', hash }} replace />;
}
