"use client";
import useChainAdapter from "@/hooks/useChainAdapter";
import { useAppKitAccount } from "@reown/appkit/react";
import {
  FC,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface ProfileDetailModel {
  walletAddress: string;
  photoUrl: string;
  appType: number;
  balance?: number;
}

type ProfileContextValue = {
  profileDetail: ProfileDetailModel | undefined;
  setProfileDetail: (profile: ProfileDetailModel | undefined) => void;
};

const ProfileContext = createContext<ProfileContextValue>({
  profileDetail: undefined,
  setProfileDetail: () => {},
});

const ProfileProvider: FC<PropsWithChildren> = ({ children }) => {
  // const { address } = useChainAdapter();
  const { address } = useAppKitAccount();
  const [profileDetail, setProfileDetail] = useState<
    ProfileDetailModel | undefined
  >(undefined);

  const getProfileDetail = useCallback(async () => {
    if (address) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_PROFILE_API}/api/users/profile-detail`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              appType: 999,
            }),
          }
        );
        if (response.status === 200) {
          const data = await response.json();

          setProfileDetail(data);

          localStorage.setItem("profile-detail", JSON.stringify(data));
        }
      } catch (error) {
        console.error(error);
      }
    }
  }, [address]);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profileDetail,
      setProfileDetail,
    }),
    [profileDetail, setProfileDetail]
  );

  useEffect(() => {
    getProfileDetail();
  }, [getProfileDetail]);

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);

export default ProfileProvider;
