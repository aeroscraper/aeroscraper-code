import useOutsideHandler from "@/hooks/useOutsideHandler";
import { motion } from "framer-motion";
import { FC, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { NumericFormat } from "react-number-format";
import { CounterUp } from "../CounterUp";
import Text from "../Texts/Text";
import ImageUpload from "./ImageUpload";
import Loading from "../Loading/Loading";
import GradientButton from "../Buttons/GradientButton";
import ProfilePhotoSlider from "./ProfilePhotosSlider";
import { AUSD_PRICE } from "@/utils/contractUtils";
import { Modal } from "../Modal/Modal";
import Button from "../Buttons/Button";
import { ArrowLeftIcon, ExitIcon, SolanaIcon } from "../Icons/Icons";
import { capitalizeFirstLetter } from "@/utils/stringUtils";
import { isNil } from "lodash";
import useChainAdapter from "@/hooks/useChainAdapter";
import {
  BaseCoinByChainName,
  ChainInfoByName,
  TransactionDomainByChainName,
} from "@/constants/chainConstants";
import { ChainName } from "@/enums/Chain";
import { useProfile } from "@/contexts/ProfileProvider";
import { WalletType } from "@/enums/WalletType";
import { useSolanaAdapter } from "@/hooks/useSolanaAdapter";
import { useDisconnect } from "@reown/appkit/react";

interface Props {
  showModal: boolean;
  onClose: () => void;
  balance: { ausd: number; base: number; wsol: number };
  basePrice: number;
}

type Tabs = "avatar-select" | "wallet-details";

const AccountModal: FC<Props> = (props: Props) => {
  const avatarSelectRef = useRef<HTMLDivElement>(null);
  const qrCodeViewRef = useRef<HTMLDivElement>(null);

  const { walletInfo, address, isWalletConnected, username } =
    useSolanaAdapter();
  const selectedChainName = ChainName.SOLANA;
  const { disconnect } = useDisconnect();
  const baseCoin = BaseCoinByChainName[selectedChainName];
  const chainInfo = ChainInfoByName[selectedChainName];

  // const {
  //   // selectedChainName,
  //   // username,
  //   // address,
  //   // baseCoin,
  //   // walletInfo,
  //   // chainInfo,
  //   // disconnect,
  //   // disconnectMetamask,
  //   // disconnectXion,
  // } = useChainAdapter();
  const { profileDetail, setProfileDetail } = useProfile();

  const [selectedTab, setSelectedTab] = useState<Tabs | null>(null);

  const [isClipped, setIsClipped] = useState<"QR" | "WALLET" | null>(null);

  const [photoUrlInput, setPhotoUrlInput] = useState<string>("");
  const [processLoading, setProcessLoading] = useState<{
    status: boolean;
    idx?: number;
  }>({ status: false, idx: -1 });

  const [errorLargeSize, setErrorLargeSize] = useState<boolean>(false);

  const openAvatarSelection = () => {
    setSelectedTab("avatar-select");
  };

  const closeAvatarSelection = () => {
    setSelectedTab(null);
  };

  const openQrCodeView = () => {
    setSelectedTab("wallet-details");
  };

  const closeQrCodeview = () => {
    setSelectedTab("wallet-details");
    setIsClipped(null);
  };

  const closeModal = () => {
    setIsClipped(null);
    props.onClose();
  };

  const logout = () => {
    // if (selectedChainName === ChainName.XION) {
    //   disconnectXion();
    // } else if (walletInfo?.name === WalletType.METAMASK) {
    //   disconnectMetamask();
    // } else {
    //   disconnect();
    // }
    disconnect();
    setProfileDetail(undefined);
    localStorage.removeItem("profile-detail");
    localStorage.removeItem("selectedWallet");
    closeModal();
  };

  const updateProfilePhoto = async (photoUrl: string, idx?: number) => {
    const previousPhotos =
      JSON.parse(localStorage.getItem("previous-photos")!) ?? [];
    if (address) {
      setProcessLoading({ status: true, idx });

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_PROFILE_API}/api/users/update-profile-detail`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              photoUrl: photoUrl,
              appType: 999,
            }),
          }
        );
        if (response.status === 200) {
          const data = await response.json();

          localStorage.setItem(
            "previous-photos",
            JSON.stringify([photoUrl, ...previousPhotos])
          );

          localStorage.setItem("profile-detail", JSON.stringify(data.user));

          setPhotoUrlInput("");

          setProfileDetail({
            walletAddress: address,
            photoUrl: photoUrl,
            appType: 999,
          });

          closeAvatarSelection();

          setErrorLargeSize(false);
        }

        if (response.status === 413) {
          setErrorLargeSize(true);
        }
      } catch (error) {
        console.error(error);
      }
    }
    setProcessLoading({ status: false, idx: -1 });
  };

  useOutsideHandler(avatarSelectRef, closeAvatarSelection);
  useOutsideHandler(qrCodeViewRef, closeQrCodeview);

  let scanDomain =
    TransactionDomainByChainName[chainInfo.name as ChainName]?.accountUrl;

  return (
    <Modal
      title="Profile"
      modalSize="lg"
      showModal={props.showModal}
      onClose={closeModal}
    >
      <div className="flex md:flex-row flex-col md:h-[644px]">
        <button
          className="md:flex hidden items-center justify-center absolute bottom-10 left-12 z-[10]"
          onClick={logout}
        >
          <span className="text-[#ED0E00] text-sm md:text-base font-medium mr-2">
            Log out
          </span>
          <ExitIcon className="text-[#ED0E00]" />
        </button>
        <div className="pt-8 md:pt-10 pr-0 pb-6 md:pb-0 md:pr-24 shrink-0 px-8 border-b md:border-r border-white/10 h-full relative">
          <h2 className="text-[#F7F7FF] text-2xl font-medium">Profile</h2>
          <div className="flex flex-row md:flex-col mt-6 gap-0 -ml-8 md:ml-0 md:gap-6">
            <Button
              active={selectedTab === "avatar-select"}
              onClick={() => {
                setSelectedTab("avatar-select");
              }}
            >
              Set an avatar
            </Button>
            <Button
              active={selectedTab === "wallet-details"}
              onClick={() => {
                setSelectedTab("wallet-details");
              }}
            >
              Wallet details
            </Button>
          </div>
        </div>
        <div
          className={`flex-1 flex flex-col items-center justify-center text-center rounded-3xl md:mt-0 mt-6 relative`}
        >
          {selectedTab !== null && (
            <button
              className="absolute left-3 md:left-8 -top-4 md:top-8"
              onClick={() => {
                setSelectedTab(null);
              }}
            >
              <ArrowLeftIcon className="text-white" />
            </button>
          )}
          {selectedTab === null && (
            <div className="px-4 md:px-40 w-full">
              <div className="space-y-8">
                <div
                  onClick={openAvatarSelection}
                  className="secondary-gradient w-[148px] h-[148px] p-0.5 rounded-lg gap-2 mx-auto cursor-pointer"
                >
                  <img
                    alt="user-profile-image"
                    src={profileDetail?.photoUrl ?? profilePhotos[0]}
                    className="w-full h-full rounded-md bg-raisin-black"
                  />
                </div>
                <Text size="3xl" textColor="text-white">
                  {username}
                </Text>
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <Text size="xl">
                  {address?.slice(0, 24)}...{address?.slice(-6)}
                </Text>
                {isClipped === "WALLET" ? (
                  <Text size="xs" textColor="text-[#37D489]">
                    Copied!
                  </Text>
                ) : (
                  <button
                    className="w-6 h-6 active:scale-90"
                    onClick={() => {
                      setIsClipped("WALLET");
                      navigator.clipboard.writeText(address ?? "");
                    }}
                  >
                    <img
                      alt="copy-to-clipboard"
                      src="/images/copy-to-clipboard.svg"
                      className="w-full h-full"
                    />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-3 gap-y-4 gap-x-20  w-full md:items-end justify-between mt-10">
                <div className="col-span-1 md:ml-0 ml-4">
                  <NumericFormat
                    value={props.balance.ausd}
                    thousandsGroupStyle="thousand"
                    thousandSeparator=","
                    fixedDecimalScale
                    decimalScale={2}
                    displayType="text"
                    renderText={(value) => (
                      <Text
                        size="lg"
                        className="mt-2 whitespace-nowrap flex gap-2 items-center"
                      >
                        <img
                          alt="ausd"
                          className="w-5 h-5"
                          src="/images/token-images/ausd-blue.svg"
                        />
                        {value}&nbsp; AUSD
                      </Text>
                    )}
                  />
                </div>
                <div className="col-span-1">
                  <NumericFormat
                    className="col-span-1"
                    value={props.balance.base}
                    thousandsGroupStyle="thousand"
                    thousandSeparator=","
                    fixedDecimalScale
                    decimalScale={2}
                    displayType="text"
                    renderText={(value) => (
                      <Text
                        size="lg"
                        className="mt-2 whitespace-nowrap flex gap-2 items-center ml-6"
                      >
                        {baseCoin && <SolanaIcon />}
                        {value}&nbsp;
                        {baseCoin?.name}
                      </Text>
                    )}
                  />
                </div>
                <div className="col-span-1">
                  <NumericFormat
                    value={props.balance.wsol}
                    thousandsGroupStyle="thousand"
                    thousandSeparator=","
                    fixedDecimalScale
                    decimalScale={4}
                    displayType="text"
                    renderText={(value) => (
                      <Text
                        size="lg"
                        className="mt-2 whitespace-nowrap flex gap-2 items-center"
                      >
                        <SolanaIcon />
                        {value}&nbsp; WSOL
                      </Text>
                    )}
                  />
                </div>
              </div>
              <button className="flex md:hidden mt-10 mb-6" onClick={logout}>
                <span className="text-[#ED0E00] text-sm md:text-base font-medium mr-2">
                  Log out
                </span>
                <ExitIcon className="text-[#ED0E00]" />
              </button>
            </div>
          )}
          {selectedTab === "avatar-select" && (
            <div className="md:px-24 px-6 mt-4 md:mt-0 w-full text-start relative z-[999]">
              <Text size="lg" textColor="text-dark-silver" className="mb-6">
                Select an avatar
              </Text>
              <ProfilePhotoSlider
                processLoading={processLoading}
                updateProfilePhoto={updateProfilePhoto}
                slider={profilePhotos}
              />
              <div className="mt-2 md:mt-6 pt-2 md:pt-6 border-t-2 border-white/10">
                <Text size="lg" textColor="text-dark-silver" className="mb-6">
                  Uplod an Avatar
                </Text>
                <div className="flex md:flex-row flex-col items-center gap-6">
                  <div className="w-2/3 md:w-[148px]">
                    <ImageUpload
                      type={2}
                      processLoading={processLoading.status}
                      onImageUpload={(e) => {
                        updateProfilePhoto(e);
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="relative bg-[#211021] w-full px-4 py-3 rounded-lg flex items-center whitespace-nowrap">
                      <Text
                        size="base"
                        className="mr-auto"
                        textColor="text-white"
                      >
                        Upload with URL:
                      </Text>
                      <input
                        value={photoUrlInput}
                        onChange={(e) => {
                          setPhotoUrlInput(e.target.value);
                        }}
                        className="focus:outline-none text-white bg-transparent flex-1 ml-3"
                      />
                    </div>
                    <GradientButton
                      onClick={() => {
                        updateProfilePhoto(photoUrlInput);
                      }}
                      className="w-full md:w-[200px] h-10 ml-auto mt-4 md:mt-10"
                      rounded="rounded-lg"
                    >
                      {processLoading.status ? (
                        <Loading width={20} height={20} />
                      ) : (
                        <Text>Save</Text>
                      )}
                    </GradientButton>
                  </div>
                </div>
                {errorLargeSize && (
                  <motion.div
                    onClick={() => {
                      setErrorLargeSize(false);
                    }}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-orange-600 p-2 bg-orange-200 rounded text-sm w-full cursor-pointer mt-4"
                  >
                    Payload too Large (max. 75kb)
                  </motion.div>
                )}
              </div>
              <button className="flex md:hidden my-6" onClick={logout}>
                <span className="text-[#ED0E00] text-sm md:text-base font-medium mr-2">
                  Log out
                </span>
                <ExitIcon className="text-[#ED0E00]" />
              </button>
            </div>
          )}
          {selectedTab === "wallet-details" && (
            <div className="md:px-8 w-full">
              <div className="flex items-center ml-[10%] gap-4 md:gap-0 md:mb-16 md:mt-12">
                {selectedChainName && (
                  <div>
                    <Text
                      size="sm"
                      className="text-center mb-3"
                      textColor="text-dark-silver"
                    >
                      Selected chain
                    </Text>
                    <Button
                      startIcon={
                        // <img
                        //   alt={selectedChainName}
                        //   src={baseCoin?.image}
                        //   className="w-6 h-6"
                        // />
                        <SolanaIcon />
                      }
                    >
                      {capitalizeFirstLetter(
                        chainInfo.displayName.toLocaleLowerCase()
                      )}
                    </Button>
                  </div>
                )}
                <div className="md:ml-14">
                  <Text
                    size="sm"
                    className="text-center mb-3"
                    textColor="text-dark-silver"
                  >
                    Selected wallet
                  </Text>
                  <Button
                    startIcon={
                      !isNil(walletInfo) && (
                        <img
                          alt={walletInfo.name}
                          src={walletInfo.logo as string}
                          className="w-6 h-6"
                        />
                      )
                    }
                  >
                    {capitalizeFirstLetter(
                      walletInfo?.prettyName?.toLocaleLowerCase() ?? ""
                    )}
                  </Button>
                </div>
                <a
                  href={`${scanDomain}${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto underline text-white mt-6 hidden md:flex"
                >
                  Scan
                  <img
                    alt="link"
                    src="/images/external-link.svg"
                    className="w-full h-full object-contain ml-1.5"
                  />
                </a>
              </div>
              <Text
                size="lg"
                textColor="text-white"
                className="mb-3 md:mt-0 mt-4"
              >
                {username}
              </Text>
              <div className="md:w-[309px] w-[220px] h-[220px] md:h-[309px] bg-white rounded-lg p-3 mx-auto">
                <QRCode className="w-full h-full" value={address ?? ""} />
              </div>
              <div className="flex gap-4 mt-6 justify-center">
                <Text size="xl">
                  {address?.slice(0, 24)}...{address?.slice(-6)}
                </Text>
                {isClipped === "WALLET" ? (
                  <Text size="xs" textColor="text-[#37D489]">
                    Copied!
                  </Text>
                ) : (
                  <button
                    className="w-6 h-6 active:scale-90"
                    onClick={() => {
                      setIsClipped("WALLET");
                      navigator.clipboard.writeText(address ?? "");
                    }}
                  >
                    <img
                      alt="copy-to-clipboard"
                      src="/images/copy-to-clipboard.svg"
                      className="w-full h-full"
                    />
                  </button>
                )}
              </div>
              <button className="flex md:hidden m-6" onClick={logout}>
                <span className="text-[#ED0E00] text-sm md:text-base font-medium mr-2">
                  Log out
                </span>
                <ExitIcon className="text-[#ED0E00]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AccountModal;

const profilePhotos = [
  "/images/profile-images/profile-i-1.jpg",
  "/images/profile-images/profile-i-2.jpg",
  "/images/profile-images/profile-i-3.jpg",
  "/images/profile-images/profile-i-4.jpg",
  "/images/profile-images/profile-i-5.jpg",
];
