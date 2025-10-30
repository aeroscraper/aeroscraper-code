import { FunctionComponent, ReactElement } from "react";
import SkeletonLoading from "./SkeletonLoading";

interface TableColProps {
  col: number,
  text: string,
  value: string | number | ReactElement,
  valueMedium?: boolean,
  inputColor?: string,
  loading?: boolean
}

export const TableBodyCol: FunctionComponent<TableColProps> = (props: TableColProps) => {

  return (
    <>
      <div className={`col-span-${props.col} flex min-h-[52px] items-center`}>
        <div className={`w-full`}>
          <div className={`${props.inputColor ? props.inputColor : "text-gray-600"} text-center`} >
            {props.loading ?
              <SkeletonLoading height={"h-5"} />
              :
              props.value
            }
          </div>
        </div>
      </div >
    </>
  )
}
