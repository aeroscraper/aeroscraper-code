import { useAppContext } from "@/contexts/AppProvider";
import { defaultContent, injContent } from "@/data/injContent";
import { ChainName } from "@/enums/Chain";
import Link from "next/link";
import { use, useEffect, useState } from "react";
interface Content {
  title: string;
  desc: string;
  linkStr?: string;
  linkUrl?: string;
}
[];

export default function RenderContent({
  showContentIdx,
}: {
  showContentIdx: number;
}) {
  const { selectedChainName } = useAppContext();

  const [content, setContent] = useState( defaultContent);
  useEffect(() => {
    setContent(ChainName.INJECTIVE === selectedChainName ? injContent : defaultContent);
  }, [selectedChainName]);
  const item = content[showContentIdx] as Content;
  const parts = item?.linkStr ? item?.desc.split(item?.linkStr) : [];
  return (
    <>
      <h1 className="text-white text-2xl md:text-[39px] md:leading-[50px] font-semibold">
        {item?.title}
      </h1>
      {item?.linkStr && item?.linkUrl ? (
        <h2 className="text-sm md:text-base text-ghost-white leading-6 font-medium mt-2 md:mt-4">
          {parts[0]}
          <Link
            target={"_blank"}
            href={item?.linkUrl}
            className="text-[#F8B810] animate-pulse"
          >
            {item?.linkStr}
          </Link>
          {parts[1]}
        </h2>
      ) : (
        <h2 className="text-sm md:text-base text-ghost-white leading-6 font-medium mt-2 md:mt-4">
          {item?.desc}
        </h2>
      )}
    </>
  );
}
