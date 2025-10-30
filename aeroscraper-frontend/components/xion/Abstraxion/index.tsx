import { useContext, useEffect, useRef } from "react";
import { GrazProvider } from "graz";
import { StytchProvider } from "@stytch/nextjs";
import { ApolloProvider } from "@apollo/client";
import {
  AbstraxionContext,
  AbstraxionContextProps,
  AbstraxionContextProvider,
} from "@/components/xion/AbstraxionContext";
import { apolloClient, stytchClient } from "@/lib/xion/lib";
import { Dialog, DialogContent } from "@burnt-labs/ui";
import { AbstraxionSignin } from "@/components/xion/AbstraxionSignin";
import { useAbstraxionAccount } from "@/hooks/xion";
import { Loading } from "@/components/xion/Loading";
import { AbstraxionWallets } from "@/components/xion/AbstraxionWallets";
import { ErrorDisplay } from "@/components/xion/ErrorDisplay";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export interface ModalProps {
  onClose: VoidFunction;
  isOpen: boolean;
}

export const Abstraxion = ({ isOpen, onClose }: ModalProps) => {
  const searchParams = useSearchParams();
  const modalRef = useRef<HTMLDivElement>(null);

  const { abstraxionError } = useContext(
    AbstraxionContext,
  ) as AbstraxionContextProps;

  const {
    isConnected,
    isConnecting,
    isReconnecting,
    data: account,
  } = useAbstraxionAccount();

  const contracts = searchParams.get("contracts");
  const contractsArray = contracts?.split(",") || [];

  const grantee = searchParams.get("grantee");
  useEffect(() => {
    const closeOnEscKey = (e: any) => (e.key === "Escape" ? onClose() : null);
    document.addEventListener("keydown", closeOnEscKey);
    return () => {
      document.removeEventListener("keydown", closeOnEscKey);
    };
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          {abstraxionError ? (
            <ErrorDisplay message={abstraxionError} onClose={onClose} />
          ) : isConnecting || isReconnecting ? (
            <Loading />
          ) : isConnected ? (
            <AbstraxionWallets onClose={onClose} />
          ) : (
            <AbstraxionSignin />
          )}
        </DialogContent>
      </Dialog>
      
    </>
  );
};

export const AbstraxionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <AbstraxionContextProvider>
      <StytchProvider stytch={stytchClient}>
        <ApolloProvider client={apolloClient}>
          <GrazProvider>{children}</GrazProvider>
        </ApolloProvider>
      </StytchProvider>
    </AbstraxionContextProvider>
  );
};
