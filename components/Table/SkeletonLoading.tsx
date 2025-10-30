import React, { FC } from 'react';

type Props = {
  height: string,
  width?: string,
  color?: string,
  noPadding?: boolean,
  noMargin?:boolean,
}
const SkeletonLoading: FC<Props> = ({ height, width = "w-full", color = "loading-gradient", noPadding,noMargin }) => {
  return (
    <div className={`${noPadding ? "" : "p-4"} rounded-md animate-pulse`}>
      <div className={`${color} ${noMargin ? "mb-0":"mb-2"} rounded ${height} ${width}`}></div>
    </div>
  );
};

export default SkeletonLoading;