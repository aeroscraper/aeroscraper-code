import React, { useState, useRef, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import Loading from "../Loading/Loading";
import { useProfile } from "@/contexts/ProfileProvider";

interface Props {
  slider: string[],
  processLoading: { status: boolean, idx?: number },
  updateProfilePhoto: (photoUrl: string, idx?: number) => Promise<void>
}

const ProfilePhotoSlider: React.FC<Props> = (props) => {
  const sliderRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(0);
  const { profileDetail } = useProfile();

  const previousPhotosJson = localStorage.getItem("previous-photos");
  const previousPhotos: string[] = previousPhotosJson
    ? JSON.parse(previousPhotosJson)
    : [];

  //@ts-ignore
  const slider = [...new Set([...previousPhotos, ...props.slider])];

  useLayoutEffect(() => {
    if (sliderRef.current) {
      setWidth(sliderRef.current?.scrollWidth - sliderRef.current?.offsetWidth);
    }
  }, []);

  return (
    <motion.div
      className="w-full overflow-hidden"
      ref={sliderRef}
      whileTap={{ cursor: "grabbing" }}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: -(width + 96), right: 0 }}
        className="flex gap-4 w-full"
      >
        {Array.from(slider).map((photo, idx) => (
          <motion.div
            key={idx}
            className="min-w-[80px] min-h-[80px]"
            initial="enter"
            animate="center"
            exit="exit"
            variants={variants}
          >
            <div
              key={photo}
              className={`relative cursor-pointer hover:opacity-80 transition secondary-gradient flex items-center rounded-md justify-center p-0.5 ${profileDetail?.photoUrl === photo ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => { props.updateProfilePhoto(photo, idx); }}
            >
              <img alt={`profile_photo`} className='rounded bg-[#6F6F73] w-[80px] h-[80px] object-cover' src={photo} />
              {(props.processLoading.status && props.processLoading.idx == idx) && <Loading height={48} width={48} className="absolute" />}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

const variants = {
  enter: {
    x: "-100%",
    opacity: 0,
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: {
    x: "100%",
    opacity: 0,
  },
};

export default ProfilePhotoSlider;