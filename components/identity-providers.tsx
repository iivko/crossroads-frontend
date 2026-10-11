"use client";

import { useEffect, useId, useState } from "react";
import { ArrowUpRight, UserRound } from "lucide-react";
import { connectionsApi, type Provider } from "@/lib/connections";
import {
  identityProviders,
  providerAvailability,
  type ProviderStatus,
} from "@/lib/identity-providers";

export function useIdentityProviders() {
  const [providers, setProviders] = useState(() => identityProviders([]));
  const [status, setStatus] = useState<ProviderStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    connectionsApi
      .providers()
      .then((value) => {
        const next = identityProviders(value);
        if (alive) {
          setProviders(next);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((current) => current + 1);
  }

  return { providers, status, retry };
}

export function IdentityProviderOptions({
  providers,
  status,
  retry,
  mode,
  busy = false,
  onLink,
}: {
  providers: Provider[];
  status: ProviderStatus;
  retry: () => void;
  mode: "login" | "link";
  busy?: boolean;
  onLink?: (provider: Provider) => void;
}) {
  const id = useId();
  return (
    <div className={mode === "login" ? "provider-signin" : "provider-list"}>
      {providers.map((provider) => {
        const state = providerAvailability(provider, status, mode);
        const descriptionId = `${id}-${provider.id}`;
        const description = state.detail ? descriptionId : undefined;
        if (mode === "login") {
          const content = (
            <>
              <span className="provider-name">
                <UserRound size={18} aria-hidden="true" />
                Continue with {provider.label}
              </span>
              {state.available ? (
                <ArrowUpRight size={16} aria-hidden="true" />
              ) : (
                <span className="provider-action-state">{state.label}</span>
              )}
            </>
          );
          return (
            <div className="provider-login-option" key={provider.id}>
              {state.available ? (
                <a
                  className="button quiet wide provider-action"
                  href={`/api/v1/identity/${provider.id}/login`}
                >
                  {content}
                </a>
              ) : (
                <button
                  type="button"
                  className="button quiet wide provider-action"
                  disabled
                  aria-describedby={description}
                >
                  {content}
                </button>
              )}
              {state.detail && <small id={descriptionId}>{state.detail}</small>}
            </div>
          );
        }
        return (
          <div className="provider-row" key={provider.id}>
            <div>
              <strong className="provider-name">
                <UserRound size={18} aria-hidden="true" />
                {provider.label}
              </strong>
              <small id={descriptionId}>{state.detail}</small>
            </div>
            <button
              type="button"
              className="button quiet"
              disabled={!state.available || busy}
              aria-describedby={description}
              onClick={() => onLink?.(provider)}
            >
              {state.label}
            </button>
          </div>
        );
      })}
      {status === "error" && (
        <div className="provider-retry">
          <small role="alert">
            Sign-in options are temporarily unavailable.
          </small>
          <button type="button" className="text-button" onClick={retry}>
            Retry sign-in options
          </button>
        </div>
      )}
      {mode === "login" && (
        <small>
          First sign in with your password, then link a provider in Connections.
          Already linked? Use it above.
        </small>
      )}
    </div>
  );
}

export function ProviderSignIn() {
  const identity = useIdentityProviders();
  return <IdentityProviderOptions {...identity} mode="login" />;
}
