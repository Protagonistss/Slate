import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { bootstrapApp } from "@/app/bootstrap";
import { createAppRouter } from "@/app/router";
import { Loading, ToastContainer } from "@/shared/ui";

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await bootstrapApp();

      setIsReady(true);
    };

    initialize();
  }, []);

  if (!isReady) {
    return (
      <Loading fullScreen text="Loading..." />
    );
  }

  const appRouter = createAppRouter();

  return (
    <>
      <RouterProvider router={appRouter} />
      <ToastContainer />
    </>
  );
}

export default App;
