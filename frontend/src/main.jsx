import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { setApiClientHooks } from "./lib/apiClient.js";
import { queryClient } from "./lib/queryClient.js";
import { ScoreDeliveryProvider } from "./providers/ScoreDeliveryProvider.jsx";
import "./index.css";

if (import.meta.env.DEV) {
  setApiClientHooks({
    onRequest: ({ method, url }) => {
      console.info(`[api] ${method} ${url}`);
    },
    onSuccess: ({ method, url, status }) => {
      console.info(`[api] ${method} ${url} -> ${status}`);
    },
    onError: ({ method, url, error }) => {
      console.error(`[api] ${method} ${url} -> ${error.status ?? "network"}`, error);
    },
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ScoreDeliveryProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ScoreDeliveryProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
