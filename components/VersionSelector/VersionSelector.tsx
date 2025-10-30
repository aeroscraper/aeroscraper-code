import useChainAdapter from "@/hooks/useChainAdapter";
import React, { useCallback, useRef, useState } from "react";
import BorderedContainer from "../Containers/BorderedContainer";
import Dropdown, { DropdownRef } from "../Dropdown/Dropdown";
import Text from "../Texts/Text";
import { CheckIcon, ChevronUpIcon } from "../Icons/Icons";
import { AppVersion } from "@/types/types";

const VersionSelector = () => {
  const dropdownRef = useRef<DropdownRef>(null);
  const [selectedAppVersion, setSelectedAppVersion] = useState<AppVersion>(
    AppVersion.V2
  );

  const changeAppVersion = useCallback((appVersion: AppVersion) => {
    setSelectedAppVersion(appVersion);
    localStorage.setItem("selectedAppVersion", appVersion);
  }, []);
  // const { selectedAppVersion, changeAppVersion } = useChainAdapter();

  return (
    <Dropdown
      ref={dropdownRef}
      toggleButton={
        <div className="w-[100px] h-full flex justify-center items-center gap-2 shrink-0">
          <Text size="sm" className="whitespace-nowrap">
            {selectedAppVersion}
          </Text>
          <ChevronUpIcon className="w-6 h-6 text-white shrink-0 rotate-180" />
        </div>
      }
    >
      <BorderedContainer
        containerClassName="w-[155px] notification-dropdown-gradient p-[1.5px]"
        className="flex flex-col px-4"
      >
        {Object.values(AppVersion).map((version, index, { length }) => {
          return (
            <>
              <div
                key={version}
                className={`flex items-center gap-2 py-4 cursor-pointer transition ${
                  version === selectedAppVersion
                    ? "opacity-100"
                    : "opacity-60 hover:opacity-80"
                }`}
                onClick={() => {
                  changeAppVersion(version);
                  dropdownRef.current?.closeDropdown();
                }}
              >
                {version === selectedAppVersion && <CheckIcon />}
                <Text size="sm">{version}</Text>
              </div>
              {index < length - 1 && (
                <span className="w-full h-[1px] bg-white bg-opacity-100" />
              )}
            </>
          );
        })}
      </BorderedContainer>
    </Dropdown>
  );
};

export default VersionSelector;
