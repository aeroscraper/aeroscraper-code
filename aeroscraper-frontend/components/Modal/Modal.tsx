'use client';

import useOutsideHandler from "@/hooks/useOutsideHandler";
import { motion } from "framer-motion";
import { FunctionComponent, ReactElement, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { CloseIcon } from "../Icons/Icons";

interface ModalProps {
  title?: string,
  children?: ReactElement,
  showModal: boolean,
  onClose?: () => void,
  modalSize?: "sm" | "md" | "lg",
}

const SIZE_VARIANT = {
  'sm': {
    width: 'w-full md:w-[65%]',
    height: 'h-[65%]',
  },
  'md': {
    width: 'w-full md:w-[65%]',
    height: 'h-[65%]',
  },
  'lg': {
    width: 'w-[100%] sm:w-[95%] md:w-[65%]',
    height: 'h-[95%] sm:h-[80%] md:h-auto',
  }
}

const TITLE_SIZE_VARIANT: Record<string, 'lg' | 'base' | '2xl'> = {
  'sm': 'lg',
  'md': 'base',
  'lg': '2xl'
}

export const Modal: FunctionComponent<ModalProps> = ({ modalSize = "lg", ...props }: ModalProps) => {

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window != 'undefined' && window.document && props.showModal) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'auto';
    }
  }, [props.showModal]);

  useEffect(() => {
    const listenerKeydown = (e: any) => {
      if (e.code === "Esc") {
        closeModal();
      }
    }
    document.addEventListener('keydown', listenerKeydown);
    return () => {
      document.removeEventListener("keydown", listenerKeydown);
    }
  }, []);

  const closeModal = () => {
    props.onClose?.();
  }

  useOutsideHandler(ref, closeModal);

  //#endregion

  if (!props.showModal) return null;

  return ReactDOM.createPortal(
    <div className="inset-0 fixed flex items-center justify-center px-2 z-50">
      <motion.div
        ref={ref}
        initial={{ scale: 0.85, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 25,
        }}
        className={`z-[70] ${SIZE_VARIANT[modalSize].width} ${SIZE_VARIANT[modalSize].height} bg-chinese-black rounded-[28px] relative overflow-y-auto`}
      >
        {props.onClose && <button onClick={closeModal} className="absolute top-8 right-8 z-[100]">
          <CloseIcon className="w-6 h-6" />
        </button>}
        {props.children}
      </motion.div>
      <div className="bg-gray-900 bg-opacity-40 inset-0 fixed z-60 backdrop-blur-[1px]"></div>
    </div>
    , document.body);
};

