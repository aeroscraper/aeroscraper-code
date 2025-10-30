"use client";

import MaintenancePage from "@/components/MaintenancePage";
import { useState } from "react";
// import AppTheme from "./AppTheme";
import AppTheme from "./AppTheme";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [isProjectMaintenance] = useState(false); // manage the project's maintenance status here

  if (isProjectMaintenance) {
    return <MaintenancePage />;
  }

  return (
    <>
      <AppTheme />

      {/* <WalletConnectButton /> */}
      <div className="container mx-auto px-3 md:px-[64px]">{children}</div>
    </>
  );
};

export default AppLayout;
