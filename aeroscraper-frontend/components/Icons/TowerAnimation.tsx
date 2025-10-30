'use client'

import { motion } from "framer-motion"
import { FC, useEffect, useState } from "react"

interface SvgProps {
  isGradient: boolean
}
export const TowerAnimation: FC = () => {

  const currentTime = new Date();
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();

  const currentIndex = (hours * 2) + Math.floor(minutes / 30);

  const finalIndex = (currentIndex % 16) || 1;

  const checkThatTime = (index: number): boolean => {
    return finalIndex === index;
  }

  return (
    <motion.div
      initial={{ opacity: 0, translateX: -400 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ delay: 0.2, duration: 0.65, type: 'spring', damping: 50 }}
      className="absolute left-0 bottom-0 top-16 flex flex-col items-start gap-8">
      <div className="flex flex-col items-center ml-8 gap-2">
        <TowerFirstIcon isGradient={checkThatTime(1)} />
        <TowerSecondIcon isGradient={checkThatTime(2)} />
        <TowerThirdIcon isGradient={checkThatTime(3)} />
        <TowerFourthIcon isGradient={checkThatTime(4)} />
        <TowerFifthIcon isGradient={checkThatTime(5)} />
        <TowerSixthIcon isGradient={checkThatTime(6)} />
        <TowerSeventhIcon isGradient={checkThatTime(7)} />
      </div>
      <div className="space-y-3 -mt-2">
        <TowerEighthIcon isGradient={checkThatTime(8)} />
        <TowerNinthIcon isGradient={checkThatTime(9)} />
        <TowerTenthIcon isGradient={checkThatTime(10)} />
        <TowerEleventhIcon isGradient={checkThatTime(11)} />
        <TowerTwelfthIcon isGradient={checkThatTime(12)} />
        <TowerThirteenthIcon isGradient={checkThatTime(13)} />
        <TowerFourteenthIcon isGradient={checkThatTime(14)} />
        <TowerFifteenthIcon isGradient={checkThatTime(15)} />
        <TowerSixteenthIcon isGradient={checkThatTime(16)} />
      </div>
    </motion.div>
  )
}

const TowerFirstIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.7 }} width="123" height="155" viewBox="0 0 123 155" fill="none">
      <path d="M12.931 154.039C20.0445 154.039 25.817 148.267 25.817 141.163C25.817 135.75 39.3735 125.828 61.511 125.828C83.6582 125.828 97.2148 135.75 97.2148 141.163C97.2148 148.267 102.987 154.039 110.101 154.039C117.205 154.039 122.977 148.267 122.977 141.163C122.977 121.086 102.482 104.789 74.397 100.931V14.5769C74.397 7.4731 68.6246 0 61.511 0C54.4072 0 48.6347 7.4731 48.6347 14.5769V100.94C20.5499 104.789 0.0546998 121.086 0.0546998 141.173C0.0449818 148.276 5.81745 154.039 12.931 154.039Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_1687" x1="92.748" y1="1.31345" x2="-13.9803" y2="221.226" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerSecondIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1 }} width="128" height="51" viewBox="0 0 128 51" fill="none">
      <path d="M12.931 50.4731C19.9473 50.4731 25.6518 44.8755 25.8072 37.898C27.2844 34.4385 40.6368 25.7992 63.5323 25.7992C86.4375 25.7992 99.7803 34.4385 101.267 37.898C101.432 44.8755 107.137 50.4731 114.143 50.4731C121.247 50.4731 127.02 44.7006 127.02 37.5968C127.02 16.538 99.1389 0.0466309 63.5323 0.0466309C27.9452 0.0466309 0.0546998 16.538 0.0546998 37.5968C0.0449818 44.7103 5.8077 50.4731 12.931 50.4731Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_1874" x1="95.7965" y1="0.476605" x2="82.4311" y2="87.3681" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerThirdIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.8 }} width="128" height="51" viewBox="0 0 128 51" fill="none">
      <path d="M12.931 50.4731C19.9473 50.4731 25.6518 44.8755 25.8072 37.898C27.2844 34.4385 40.6368 25.7992 63.5323 25.7992C86.4375 25.7992 99.7803 34.4385 101.267 37.898C101.432 44.8755 107.137 50.4731 114.143 50.4731C121.247 50.4731 127.02 44.7006 127.02 37.5968C127.02 16.538 99.1389 0.0466309 63.5323 0.0466309C27.9452 0.0466309 0.0546998 16.538 0.0546998 37.5968C0.0449818 44.7103 5.8077 50.4731 12.931 50.4731Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_1874" x1="95.7965" y1="0.476605" x2="82.4311" y2="87.3681" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerFourthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.85 }} width="132" height="45" viewBox="0 0 132 45" fill="none">
      <path d="M12.9213 44.5316C19.1602 44.5316 24.369 40.0905 25.5546 34.2014C29.4418 31.1791 43.9799 26.2327 65.7092 26.2327C87.4385 26.2327 101.977 31.1888 105.873 34.2014C107.059 40.0905 112.268 44.5316 118.507 44.5316C125.62 44.5316 131.393 38.7591 131.393 31.6456C131.393 17.8072 118.264 10.3536 107.263 6.53441C95.9806 2.61808 81.219 0.460693 65.7189 0.460693C50.2188 0.460693 35.4767 2.61808 24.1747 6.53441C13.174 10.3536 0.0547364 17.8072 0.0547364 31.6456C0.0353005 38.7591 5.80777 44.5316 12.9213 44.5316Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_2061" x1="99.0941" y1="0.836475" x2="89.1597" y2="77.2822" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerFifthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.9 }} width="202" height="57" viewBox="0 0 202 57" fill="none">
      <path d="M13.054 56.5663C20.1287 56.5663 25.8526 50.8813 25.94 43.8261C27.7962 38.6755 52.5089 25.9742 100.953 25.9742C149.397 25.9742 174.11 38.6755 175.985 43.8261C176.063 50.8813 181.796 56.5663 188.861 56.5663C195.975 56.5663 201.747 50.8035 201.747 43.69C201.747 13.6615 151.127 0.211914 100.953 0.211914C50.7985 0.211914 0.177734 13.6615 0.177734 43.69C0.177734 50.8035 5.94049 56.5663 13.054 56.5663Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_2248" x1="152.177" y1="0.692434" x2="141.539" y2="98.9442" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerSixthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.95 }} width="202" height="53" viewBox="0 0 202 53" fill="none">
      <path d="M13.0734 52.8399C19.7011 52.8399 25.1528 47.8352 25.872 41.4019C27.524 39.6721 33.6269 35.6197 47.99 32.0241C62.7224 28.3312 81.5267 26.3002 100.963 26.3002C120.408 26.3002 139.232 28.3312 153.945 32.0241C168.318 35.6197 174.411 39.6721 176.063 41.4019C176.782 47.8352 182.243 52.8399 188.861 52.8399C195.975 52.8399 201.747 47.0674 201.747 39.9539C201.747 26.3196 189.998 15.8534 166.831 8.8662C149.057 3.49217 125.666 0.547607 100.953 0.547607C76.2498 0.547607 52.8587 3.50189 35.0846 8.8662C11.917 15.8534 0.177734 26.3196 0.177734 39.9539C0.19717 47.0771 5.95991 52.8399 13.0734 52.8399Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_2435" x1="152.177" y1="0.993491" x2="143.003" y2="92.3102" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerSeventhIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1.1 }} transition={{ duration: 0.4, delay: 0.98 }} width="202" height="48" viewBox="0 0 202 48" fill="none">
      <path d="M13.054 47.5813C18.9528 47.5813 23.9284 43.6164 25.4541 38.1938C31.7999 33.7915 58.1064 26.6197 100.953 26.6197C143.809 26.6197 170.106 33.7915 176.461 38.1938C177.987 43.6164 182.963 47.5813 188.861 47.5813C195.975 47.5813 201.747 41.8186 201.747 34.705C201.747 15.8522 174.916 9.44808 166.102 7.349C148.542 3.16057 125.403 0.857422 100.953 0.857422C76.5025 0.857422 53.3738 3.16057 35.8134 7.349C26.9993 9.4578 0.177734 15.8522 0.177734 34.705C0.177734 41.8186 5.94049 47.5813 13.054 47.5813Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_2614" x1="152.177" y1="1.25583" x2="144.838" y2="83.0133" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerEighthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 0.8 }} animate={{ scale: 1.05 }} transition={{ duration: 0.4, delay: 1 }} width="299" height="54" viewBox="0 0 299 54" fill="none">
      <path d="M-51.7051 53.7585C-40.614 53.7585 -25.42 44.7763 -22.5513 39.1371C-10.6196 34.5591 32.92 27.1009 113.482 27.1009C194.062 27.1009 237.601 34.5591 249.551 39.1371C252.42 44.7763 267.614 53.7585 278.705 53.7585C292.08 53.7585 298.141 46.5348 298.141 39.1371C298.141 19.5315 252.551 9.24353 235.978 7.06063C202.96 2.70493 159.454 0.309814 113.482 0.309814C67.5091 0.309814 24.0215 2.70493 -8.9962 7.06063C-25.569 9.25364 -76 19.5315 -76 39.1371C-76 46.5348 -65.0803 53.7585 -51.7051 53.7585Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_2810" x1="206.132" y1="0.765559" x2="200.932" y2="94.7561" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerNinthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.15 }} transition={{ duration: 0.4, delay: 1.1 }} width="299" height="54" viewBox="0 0 299 54" fill="none">
      <path d="M-51.7067 53.4958C-40.6155 53.4958 -25.4216 44.5136 -22.5528 38.8745C-10.6212 34.2964 32.9184 26.8382 113.48 26.8382C194.06 26.8382 237.6 34.2964 249.55 38.8745C252.418 44.5136 262.753 53.4958 273.845 53.4958C287.22 53.4958 298.139 46.2721 298.139 38.8745C298.139 19.2688 252.549 8.98083 235.976 6.79793C202.959 2.44224 159.453 0.0471191 113.48 0.0471191C67.5075 0.0471191 24.0199 2.44224 -8.99775 6.79793C-25.5705 8.99094 -71.1426 14.4543 -71.1426 34.0599C-71.1426 41.4575 -65.0819 53.4958 -51.7067 53.4958Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_2997" x1="207.326" y1="0.502863" x2="202.057" y2="94.4858" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerTenthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.2 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="50" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.3876C-40.6983 49.3876 -31.343 45.2643 -28.4743 39.6252C-16.5426 35.0472 32.92 27.5889 113.482 27.5889C194.062 27.5889 243.506 35.0472 255.456 39.6252C258.325 45.2643 267.68 49.3876 278.771 49.3876C292.146 49.3876 303 43.3947 303 35.9971C303 16.3914 252.551 9.73157 235.978 7.54867C202.96 3.19297 159.454 0.797852 113.482 0.797852C67.5091 0.797852 24.0215 3.19297 -8.9962 7.54867C-25.569 9.74168 -76 16.3914 -76 35.9971C-76 43.3947 -65.1646 49.3876 -51.7894 49.3876Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3184" x1="209.796" y1="1.21216" x2="205.551" y2="86.7089" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerEleventhIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.2 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="50" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.411C-40.6983 49.411 -31.343 45.2878 -28.4743 39.6486C-16.5426 35.0706 32.92 27.6123 113.482 27.6123C194.062 27.6123 243.506 35.0706 255.456 39.6486C258.325 45.2878 267.68 49.411 278.771 49.411C292.146 49.411 303 43.4182 303 36.0205C303 16.4149 252.551 9.75501 235.978 7.57211C202.96 3.21641 159.454 0.821289 113.482 0.821289C67.5091 0.821289 24.0215 3.21641 -8.9962 7.57211C-25.569 9.76511 -76 16.4149 -76 36.0205C-76 43.4182 -65.1646 49.411 -51.7894 49.411Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3371" x1="209.796" y1="1.2356" x2="205.551" y2="86.7324" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerTwelfthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.2 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="50" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.4347C-40.6983 49.4347 -31.343 45.3115 -28.4743 39.6723C-16.5426 35.0943 32.92 27.636 113.482 27.636C194.062 27.636 243.506 35.0943 255.456 39.6723C258.325 45.3115 267.68 49.4347 278.771 49.4347C292.146 49.4347 303 43.4418 303 36.0442C303 16.4385 252.551 9.77869 235.978 7.59579C202.96 3.24009 159.454 0.844971 113.482 0.844971C67.5091 0.844971 24.0215 3.24009 -8.9962 7.59579C-25.569 9.78879 -76 16.4385 -76 36.0442C-76 43.4418 -65.1646 49.4347 -51.7894 49.4347Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3558" x1="209.796" y1="1.25928" x2="205.551" y2="86.7561" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerThirteenthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.2 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="60" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.4347C-40.6983 49.4347 -31.343 45.3115 -28.4743 39.6723C-16.5426 35.0943 32.92 27.636 113.482 27.636C194.062 27.636 243.506 35.0943 255.456 39.6723C258.325 45.3115 267.68 49.4347 278.771 49.4347C292.146 49.4347 303 43.4418 303 36.0442C303 16.4385 252.551 9.77869 235.978 7.59579C202.96 3.24009 159.454 0.844971 113.482 0.844971C67.5091 0.844971 24.0215 3.24009 -8.9962 7.59579C-25.569 9.78879 -76 16.4385 -76 36.0442C-76 43.4418 -65.1646 49.4347 -51.7894 49.4347Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3558" x1="209.796" y1="1.25928" x2="205.551" y2="86.7561" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerFourteenthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.25 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="60" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.4347C-40.6983 49.4347 -31.343 45.3115 -28.4743 39.6723C-16.5426 35.0943 32.92 27.636 113.482 27.636C194.062 27.636 243.506 35.0943 255.456 39.6723C258.325 45.3115 267.68 49.4347 278.771 49.4347C292.146 49.4347 303 43.4418 303 36.0442C303 16.4385 252.551 9.77869 235.978 7.59579C202.96 3.24009 159.454 0.844971 113.482 0.844971C67.5091 0.844971 24.0215 3.24009 -8.9962 7.59579C-25.569 9.78879 -76 16.4385 -76 36.0442C-76 43.4418 -65.1646 49.4347 -51.7894 49.4347Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3558" x1="209.796" y1="1.25928" x2="205.551" y2="86.7561" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerFifteenthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.3 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="60" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.4347C-40.6983 49.4347 -31.343 45.3115 -28.4743 39.6723C-16.5426 35.0943 32.92 27.636 113.482 27.636C194.062 27.636 243.506 35.0943 255.456 39.6723C258.325 45.3115 267.68 49.4347 278.771 49.4347C292.146 49.4347 303 43.4418 303 36.0442C303 16.4385 252.551 9.77869 235.978 7.59579C202.96 3.24009 159.454 0.844971 113.482 0.844971C67.5091 0.844971 24.0215 3.24009 -8.9962 7.59579C-25.569 9.78879 -76 16.4385 -76 36.0442C-76 43.4418 -65.1646 49.4347 -51.7894 49.4347Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3558" x1="209.796" y1="1.25928" x2="205.551" y2="86.7561" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

const TowerSixteenthIcon: FC<SvgProps> = ({ isGradient }) => {
  return (
    <motion.svg initial={{ scale: 1 }} animate={{ scale: 1.4 }} transition={{ duration: 0.4, delay: 1.1 }} width="303" height="60" viewBox="0 0 303 50" fill="none">
      <path d="M-51.7894 49.4347C-40.6983 49.4347 -31.343 45.3115 -28.4743 39.6723C-16.5426 35.0943 32.92 27.636 113.482 27.636C194.062 27.636 243.506 35.0943 255.456 39.6723C258.325 45.3115 267.68 49.4347 278.771 49.4347C292.146 49.4347 303 43.4418 303 36.0442C303 16.4385 252.551 9.77869 235.978 7.59579C202.96 3.24009 159.454 0.844971 113.482 0.844971C67.5091 0.844971 24.0215 3.24009 -8.9962 7.59579C-25.569 9.78879 -76 16.4385 -76 36.0442C-76 43.4418 -65.1646 49.4347 -51.7894 49.4347Z" fill={isGradient ? "url(#paint0_linear_859_1687)" : "rgb(247,247,255,0.4)"} />
      <defs>
        <linearGradient id="paint0_linear_859_3558" x1="209.796" y1="1.25928" x2="205.551" y2="86.7561" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56235C" />
          <stop offset="0.294825" stopColor="#D43752" />
          <stop offset="0.402713" stopColor="#E4462D" />
          <stop offset="0.638994" stopColor="#F8B810" />
          <stop offset="0.827343" stopColor="#29499C" />
          <stop offset="1" stopColor="#2C3384" />
        </linearGradient>
      </defs>
    </motion.svg>
  )
}

