import { motion } from 'framer-motion';
import React, { FC } from 'react';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  className?: string
}

const Checkbox: FC<CheckboxProps> = ({ label, checked, onChange, className }) => {

  const variants = {
    checked: {
      scale: 1,
    },
    unchecked: {
      scale: 0.7,
    },
  };

  return (
    <label onClick={onChange} className={`inline-flex items-center cursor-pointer ${className}`}>
      <div className='tertiary-gradient w-7 h-7 rounded-full relative'>
        <div className='w-6 h-6 bg-[#1A0B1C] rounded-full top-0.5 left-0.5 z-50 absolute p-[3px]'>
          <motion.div
            className={`w-[18px] h-[18px] rounded-full cursor-pointer ${checked ? "tertiary-gradient" : ""}`}
            variants={variants}
            initial={checked ? 'checked' : 'unchecked'}
            animate={checked ? 'checked' : 'unchecked'}
            transition={{ease:"easeOut"}}
          />
        </div>
      </div>
      <span className="ml-2 text-ghost-white font-medium leading-7 text-2xl checkbox-label">{label}</span>
    </label>
  );
};

export default Checkbox;

