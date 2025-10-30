'use client';

import { useSearchParams } from 'next/navigation'
import { useEffect } from "react";
import FaqItem from "./FaqItem";

const Faq = () => {
  const faqData = [
    {
      question: `What is Aeroscraper?`,
      answer: `Aeroscraper is a decentralized lending-borrowing protocol that offers an interest-free, over-collateralized stable coin and DeFi loans, built specifically to be user-centric. <br/>
      Aeroscraper is a fully automated and governance-free decentralized protocol designed to allow unauthorized lending and borrowing for users. <br/>
      Aeroscraper allows users to deposit collateral and get loans in stablecoins pegged to US dollars. Aeroscraper has a 0% interest rate that charges users a one-time fee, instead of charging a variable interest rate for taking out loans.`,
    },
    {
      question: 'What are the main benefits of Aeroscraper?',
      answer: `
      Aeroscraper offers the best borrowing terms on the market and its main benefits are:
      <br/>
      - 0% interest rate<br/>
      - Only a 115% coverage rate<br/>
      - No management is required - all operations are algorithmic and fully automated.<br/>
      -  Direct redeemable - stablecoin can be redeemed at face value for underlying collateral anytime and anywhere<br/>
      - Censorship resistant - protocol not controlled by anyone
      `,
    },
    {
      question: `What’s the motivation behind Aeroscraper?`,
      answer: `The protocol was developed to allow owners of SEI, and INJ a method of extracting value from their holdings, without ever selling their tokens. By locking up SEI, INJ, and minting AUSD, SEI and INJ holders can take a 0% interest-free loan against their holdings, on a timeless repayment schedule. <br/>
      Stablecoins are an essential building block on any blockchain. However, the vast majority of this value is made up of centralized stablecoins. <br/> Decentralized stablecoins make up only a small portion of the total stablecoin supply. <br/>
      Aeroscraper addresses this by creating a more capital-efficient and user-friendly way to borrow a decentralized stablecoin. Furthermore, Aeroscraper is completely immutable, governance-free, and non-custodial.`,
    },
    {
      question: `Has the protocol been third-party verified, certified, and/or audited?`,
      answer: `The protocol is currently in the audit process with Beosin and the full report will be made publicly available.`,
    },
    {
      question: `Does anyone “own” or operate the protocol?`,
      answer: `No. The contract is immutable and therefore has no owner or operator.`,
    },
    {
      question: `Can Aeroscraper be upgraded or changed?`,
      answer: `No. The protocol has no admin key, and nobody can alter the rules of the system in any way. The smart contract code is completely immutable once deployed.`,
    },
  ];

  const searchParams = useSearchParams()

  const scroll = searchParams.get('scroll')

  useEffect(() => {
    if (scroll && scroll === 'FAQ') {
      const faqElement = document.getElementById('faq-section');

      if (faqElement) {
        faqElement.scrollIntoView({ behavior: 'smooth', inline: "center" });
      }
    }
  }, [scroll]);

  return (
    <div id="faq-section" className="w-full mt-12">
      <h2 className="text-4xl font-semibold text-white mb-4">FAQ</h2>
      <div className="divide divide-white/10">
        {faqData.map((item, index) => (
          <FaqItem key={index} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  );
};

export default Faq;