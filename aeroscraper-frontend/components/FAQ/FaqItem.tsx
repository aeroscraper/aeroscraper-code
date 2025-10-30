'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronUpIcon } from '../Icons/Icons';

const FaqItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAccordion = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div onClick={toggleAccordion} className="py-3 border-b border-white/20">
      <div
        className="p-2 cursor-pointer flex justify-between items-center"
      >
        <div className="font-bold text-base text-[#F7F7FF]">{question}</div>
        <div><ChevronUpIcon className={`w-5 h-5 text-white ${isOpen ? "" : "rotate-180"} transition-all duration-300`} /></div>
      </div>
      {isOpen && (
        <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="py-4 px-2">
          <p className='text-base font-normal leading-7 text-white/50' dangerouslySetInnerHTML={{ __html: answer }}></p>
        </motion.div>
      )}
    </div>
  );
};

export default FaqItem;
