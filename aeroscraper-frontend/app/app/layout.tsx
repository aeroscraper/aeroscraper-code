// import Providers from "@/contexts/Providers";
import { NotificationProvider } from "@/contexts/NotificationProvider";
import ProfileProvider from "@/contexts/ProfileProvider";
import AppLayout from "@/layouts/AppLayout";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    // <Providers>
    <NotificationProvider>
      <ProfileProvider>
        <AppLayout>{children}</AppLayout>
      </ProfileProvider>
    </NotificationProvider>
    // </Providers>
  );
};

export default Layout;
