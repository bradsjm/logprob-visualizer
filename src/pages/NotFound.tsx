import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Displays a simple 404 page and logs the missing route for diagnostics.
 */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Page not found</p>
        <a
          href="/"
          className="text-primary underline underline-offset-4 hover:text-primary-hover"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
