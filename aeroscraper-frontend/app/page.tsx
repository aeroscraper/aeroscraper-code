'use client'

import GradientButton from '@/components/Buttons/GradientButton'
import OutlinedButton from '@/components/Buttons/OutlinedButton'
import Faq from '@/components/FAQ/Faq'
import { BackgroundWave, LogoSecondary, MedalIcon } from '@/components/Icons/Icons'
import Text from '@/components/Texts/Text'
import { AbstraxionAccount } from '@/hooks/xion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
export interface AccountWithAuthenticator extends AbstraxionAccount {
  authenticators: Authenticators;
}
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    //prefetching xion page
    router.prefetch('/app/xion')
    router.prefetch('/app/dashboard')
  }, [router])

  return (
    <div>
      <main className='container w-full px-3 md:px-[64px] mx-auto '>
        <div className='flex md:flex-row flex-col w-full'>
          <div className='max-w-[626px] pt-6 md:pt-0'>
            <div className='flex items-center gap-6 lg:mt-20'>
              <LogoSecondary />
              <Text size="2xl" textColor='text-white'>Aeroscraper</Text>
            </div>
            <h1 className="text-white text-[36px] md:text-[64px] leading-[46px] md:leading-[72px] font-semibold mt-32 md:mt-10">Your decentralized lending-borrowing protocol</h1>
            <h2 className="text-base text-ghost-white font-medium mt-10">
              Empowering you with autonomy and direct transactions. Interest-free, over-collateralized stablecoin and DeFi loans. Fully automated and governance-free, which enables unauthorized lending and borrowing.
              <br /><br />
              The protocol only charges a one-time fee. Deposit collateral and access loans in stablecoins pegged to the US dollar.
            </h2>
            <div className='flex gap-8 mt-10'>
              <Link href={"/app/dashboard"}>
                <GradientButton
                  className='w-[140px] lg:w-[227px] h-[37px] rounded-lg self-end px-8 group'
                >
                  <Text size='base'>Launch App</Text>
                </GradientButton>
              </Link>
              <Link href={"https://aeroscraper.gitbook.io/aeroscraper/"} target="_blank">
                <OutlinedButton
                  className='w-[140px] lg:w-[227px] h-[41px] rounded-lg self-end group'
                >
                  <Text size='base'>Learn More</Text>
                </OutlinedButton>
              </Link>
            </div>
          </div>
          <div className="md:mt-32 md:ml-20 p-4 md:block hidden">
            <Link target={"_blank"} className="border border-[#073DC8]/60 bg-[#0c0c2766] px-4 md:px-10 py-8 rounded-lg flex gap-6 backdrop-blur-2xl" href={'https://twitter.com/Injective_/status/1745933949132488934?s=20'}>
              <div className='flex gap-4 items-center'>
                <MedalIcon className="text-[#F8B810]" />
                <Text size='3xl'>1st</Text>
              </div>
              <div>
                <div className='flex gap-4'>
                  <div className="flex items-center gap-2">
                    <img alt="token" src="/images/token-images/inj.svg" className="w-6 h-6" />
                    <Text size="base" weight="font-medium">Injective</Text>
                  </div>
                  <div className="flex items-center gap-2">
                    <img alt="token" src="/images/google_cloud.png" className="w-6 h-6" />
                    <Text size="base" weight="font-medium">Google Cloud</Text>
                  </div>
                </div>
                <Text size='xl' className='mt-4'>Injective Illuminate Hackathon</Text>
              </div>
            </Link>
            <Link target={"_blank"} className="border border-[#073DC8]/60 bg-[#0c0c2766] p-4 md:p-6 rounded-lg w-2/3 flex gap-6 backdrop-blur-2xl mt-10 mr-auto" href={'https://x.com/SeiNetwork/status/1705128171534717322?s=20'}>
              <div className='flex gap-4 items-center'>
                <MedalIcon className="text-[#E4462D]" />
                <Text size='xl'>2nd</Text>
              </div>
              <div>
                <div className='flex gap-4'>
                  <div className="flex items-center gap-2">
                    <img alt="token" src="/images/token-images/sei.png" className="w-6 h-6" />
                    <Text size="base" weight="font-medium">SEI</Text>
                  </div>
                </div>
                <Text size='base' className='mt-4'>Code Sei Hackathon</Text>
              </div>
            </Link>
          </div>
        </div>
        <div className='max-w-[626px]'>
          <Faq />
        </div>
        <div className='flex gap-8 mt-10'>
          <Link href={"/app/dashboard"}>
            <GradientButton
              className='w-[140px] lg:w-[227px] h-[37px] rounded-lg self-end px-8 group'
            >
              <Text size='base'>Launch App</Text>
            </GradientButton>
          </Link>
          <Link href={"https://aeroscraper.gitbook.io/aeroscraper/"} target="_blank">
            <OutlinedButton
              className='w-[140px] lg:w-[227px] h-[41px] rounded-lg self-end group'
            >
              <Text size='base'>Learn More</Text>
            </OutlinedButton>
          </Link>
        </div>
        <div>
          <h2 className="text-4xl font-semibold text-white mb-4 mt-14">Our Partners</h2>
          <Text size='base' className='mt-8' textColor='text-white/60'>Chains</Text>
          <div className='flex gap-4'>
            <Link className='flex gap-6' href={'https://injective.com/'}>
              <img alt={"injective"} src={"/images/token-images/injective.svg"} className='px-4 w-[148px] h-[60px] mt-4 border border-white/10 rounded-md' />
            </Link>
            <Link className='flex gap-6' href={'https://www.sei.io/'}>
              <img alt={"sei"} src={"/images/token-images/sei.svg"} className='px-4 w-[148px] h-[60px] mt-4 border border-white/10 rounded-md' />
            </Link>
          </div>
          <Text size='base' className='mt-8' textColor='text-white/60'>Security</Text>
          <Link className='flex gap-6' href={'https://beosin.com/'}>
            <img alt={"beosin security"} src={"/images/beosin.svg"} className='px-4 w-[148px] h-[60px] mt-4 border border-white/10 rounded-md' />
          </Link>
          <Text size='base' className='mt-8' textColor='text-white/60'>Oracle</Text>
          <Link className='flex gap-6' href={'https://pyth.network/'}>
            <img alt={"pyth"} src={"/images/pyth2.svg"} className='px-8 w-[148px] h-[60px] mt-4 border border-white/10 rounded-md' />
          </Link>
        </div>
        <BackgroundWave animate className="absolute top-40 md:-top-3 right-0 -z-10 md:w-[1200px] w-[300px]" />
      </main>
      <footer className='flex flex-col gap-x-48 gap-y-16 items-top flex-wrap px-6 mx-auto pr-16 mt-40 pb-24 relative md:px-[64px] container w-full'>
        <div className='flex items-center gap-6 lg:mt-20'>
          <LogoSecondary />
          <Text size="2xl" textColor='text-white'>Aeroscraper</Text>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-40'>
          <div className='flex flex-col content-start justify-start gap-4'>
            <Text size="sm" textColor='text-white' weight="font-semibold">Product</Text>
            <Link href={'https://beosin.com/audits/Aeroscraper_202402020919.pdf'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white' className="cursor-pointer">Audit</Text>
              <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
            </Link>
            <Link href={'/?scroll=FAQ'} target="_parent" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white' className="cursor-pointer">FAQ</Text>
            </Link>
            <Link href={'https://novaratio.gitbook.io/aeroscraper/aeroscraper/whitepaper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white' className="cursor-pointer">Whitepaper</Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
            <Link href={'https://aeroscraper.gitbook.io/aeroscraper/brand-identity/brand-kit'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white'>Brand Identity</Text>
              <img
                alt="external-link"
                src="/images/external-link.svg"
                className="w-4 h-4"
              />
            </Link>
          </div>
          <div className='flex flex-col content-start justify-start gap-6'>
            <Text size="sm" weight="font-semibold">Deep dive</Text>
            <div className='flex flex-col content-start gap-3'>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-name'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of name</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-icon'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of icon</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-colors'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of colors</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-typography'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of typography</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/'} className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of concept</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
            </div>
          </div>
          <div className='flex flex-col content-start justify-start gap-6'>
            <Text size="sm" weight="font-semibold">Hackathon</Text>
            <div className='flex flex-col content-start gap-3'>
              <Link href={'https://twitter.com/Injective_/status/1745933949132488934?s=20'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2 whitespace-nowrap'>
                <Text size="sm" textColor='text-white'>Injective Illuminate Hackathon</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://x.com/SeiNetwork/status/1705128171534717322?s=20'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Code Sei Hackathon</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
            </div>
          </div>
          <div className='flex flex-col content-start justify-start gap-6'>
            <Text size="sm" weight="font-semibold">Social</Text>
            <div className='flex flex-col content-start gap-4'>
              <Link href={'https://twitter.com/aeroscraper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>X</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://discord.gg/3R6yTqB8hC'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Discord</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://zealy.io/c/aeroscraper/questboard'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Zealy</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://medium.com/@aeroscraper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Medium</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://guild.xyz/aeroscraper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Guild</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
