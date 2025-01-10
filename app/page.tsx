"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicKey, publicKey, Umi } from "@metaplex-foundation/umi";
import {
  DigitalAssetWithToken,
  JsonMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import dynamic from "next/dynamic";
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { useUmi } from "./utils/useUmi";
import { GuardReturn } from "./utils/checkerHelper";
import { image, headerText } from "../settings";
import { useSolanaTime } from "./utils/SolanaTimeContext";
import {
  fetchCandyMachine,
  safeFetchCandyGuard,
  CandyGuard,
  CandyMachine,
  AccountVersion,
} from "@metaplex-foundation/mpl-candy-machine";
// import styles from "../styles/Home.module.css";
import { guardChecker } from "./utils/checkAllowed";
import {
  ModalOverlay,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalContent,
  Modal,
  Skeleton,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { ButtonList } from "./components/MintButton";
import { ShowNft } from "./components/ShowNFT";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const nftImages = ["/1.png", "/2.png", "/3.png", "/4.png"];
const useCandyMachine = (
  umi: Umi,
  candyMachineId: string,
  checkEligibility: boolean,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  firstRun: boolean,
  setfirstRun: Dispatch<SetStateAction<boolean>>
) => {
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (checkEligibility) {
        if (!candyMachineId) {
          console.error("No candy machine in .env!");
          if (!toast.isActive("no-cm")) {
            toast({
              id: "no-cm",
              title: "No candy machine in .env!",
              description: "Add your candy machine address to the .env file!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
          }
          return;
        }

        let candyMachine;
        try {
          candyMachine = await fetchCandyMachine(
            umi,
            publicKey(candyMachineId)
          );
          //verify CM Version
          if (candyMachine.version != AccountVersion.V2) {
            toast({
              id: "wrong-account-version",
              title: "Wrong candy machine account version!",
              description:
                "Please use latest sugar to create your candy machine. Need Account Version 2!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
            return;
          }
        } catch (e) {
          console.error(e);
          toast({
            id: "no-cm-found",
            title: "The CM from .env is invalid",
            description: "Are you using the correct environment?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        setCandyMachine(candyMachine);
        if (!candyMachine) {
          return;
        }
        let candyGuard;
        try {
          candyGuard = await safeFetchCandyGuard(
            umi,
            candyMachine.mintAuthority
          );
        } catch (e) {
          console.error(e);
          toast({
            id: "no-guard-found",
            title: "No Candy Guard found!",
            description: "Do you have one assigned?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        if (!candyGuard) {
          return;
        }
        setCandyGuard(candyGuard);
        if (firstRun) {
          setfirstRun(false);
        }
      }
    })();
  }, [umi, checkEligibility]);

  return { candyMachine, candyGuard };
};

const Page = () => {
  const umi = useUmi();
  const solanaTime = useSolanaTime();
  const toast = useToast();
  const {
    isOpen: isShowNftOpen,
    onOpen: onShowNftOpen,
    onClose: onShowNftClose,
  } = useDisclosure();
  const {
    isOpen: isInitializerOpen,
    onOpen: onInitializerOpen,
    onClose: onInitializerClose,
  } = useDisclosure();
  const [mintsCreated, setMintsCreated] = useState<
    | { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[]
    | undefined
  >();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([
    { label: "startDefault", allowed: false, maxAmount: 0 },
  ]);
  const [firstRun, setFirstRun] = useState(true);
  const [checkEligibility, setCheckEligibility] = useState<boolean>(true);

  if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
    console.error("No candy machine in .env!");
    if (!toast.isActive("no-cm")) {
      toast({
        id: "no-cm",
        title: "No candy machine in .env!",
        description: "Add your candy machine address to the .env file!",
        status: "error",
        duration: 999999,
        isClosable: true,
      });
    }
  }
  const candyMachineId: PublicKey = useMemo(() => {
    if (process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
    } else {
      console.error(`NO CANDY MACHINE IN .env FILE DEFINED!`);
      toast({
        id: "no-cm",
        title: "No candy machine in .env!",
        description: "Add your candy machine address to the .env file!",
        status: "error",
        duration: 999999,
        isClosable: true,
      });
      return publicKey("11111111111111111111111111111111");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { candyMachine, candyGuard } = useCandyMachine(
    umi,
    candyMachineId,
    checkEligibility,
    setCheckEligibility,
    firstRun,
    setFirstRun
  );

  useEffect(() => {
    const checkEligibilityFunc = async () => {
      if (!candyMachine || !candyGuard || !checkEligibility || isShowNftOpen) {
        return;
      }
      setFirstRun(false);

      const { guardReturn, ownedTokens } = await guardChecker(
        umi,
        candyGuard,
        candyMachine,
        solanaTime
      );

      setOwnedTokens(ownedTokens);
      setGuards(guardReturn);
      setIsAllowed(false);

      let allowed = false;
      for (const guard of guardReturn) {
        if (guard.allowed) {
          allowed = true;
          break;
        }
      }

      setIsAllowed(allowed);
      setLoading(false);
    };

    checkEligibilityFunc();
    // On purpose: not check for candyMachine, candyGuard, solanaTime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umi, checkEligibility, firstRun]);

  return (
    <div className="min-h-screen bg-[#0C0C1D] text-white">
      {/* Navbar */}
      <nav className="fixed w-full px-4 sm:px-6 py-4 flex justify-between items-center z-50 bg-[#0C0C1D]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <img
            src="/logo.jpeg"
            alt="Broke Coin Logo"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg"
          />
          <span className="text-lg sm:text-xl font-bold">BROKE COIN</span>
        </div>

        <div>
          <WalletMultiButtonDynamic />
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 sm:pt-32 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row justify-between items-center gap-8 lg:gap-12">
          {/* Left Content */}
          <div className="flex-1 w-full lg:w-auto text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-4">
              Welcome to
              <span className="block mt-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">
                Brokecoin Brokies
              </span>
            </h1>
            <p className="text-[#B4B4C7] text-base sm:text-lg mb-8 max-w-2xl mx-auto lg:mx-0">
              Join a collection of 1,000 unique Brokecoin Brokies who
              collectively decided "Valhalla or Broke again". Each NFT will come
              with benefits both in web3 and real world utility. Stay tuned for
              updates.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0">
              <div className="p-4 rounded-xl bg-[#14143A]/50 border border-[#9945FF]/20">
                <div className="text-[#B4B4C7] text-sm">Price</div>
                <div className="text-lg sm:text-xl font-semibold">0.3 SOL</div>
              </div>
              <div className="p-4 rounded-xl bg-[#14143A]/50 border border-[#9945FF]/20">
                <div className="text-[#B4B4C7] text-sm">Supply</div>
                <div className="text-lg sm:text-xl font-semibold">1,000</div>
              </div>
            </div>
          </div>

          {/* Right Content - Mint Card */}
          <div className="w-full max-w-[400px] lg:w-[400px]">
            <div className="p-1 rounded-2xl bg-gradient-to-r from-[#9945FF] to-[#14F195]">
              <div className="p-4 sm:p-6 rounded-xl bg-[#14143A]">
                <img
                  src="/logo.jpeg"
                  alt="Broke Coin Preview"
                  className="w-full aspect-square rounded-lg mb-6"
                />

                {/* Amount Controls */}

                {/* Progress */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#B4B4C7]">Minted</span>
                    <span>
                      {loading
                        ? "Loading"
                        : `${Number(candyMachine?.itemsRedeemed)}/${Number(
                            candyMachine?.data.itemsAvailable
                          )}`}
                    </span>
                  </div>
                  <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195]"
                      style={{
                        width: `${
                            (Number(candyMachine?.itemsRedeemed) /
                            Number(candyMachine?.data.itemsAvailable)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Mint Button */}

                {loading ? (
                  <div>
                    <Skeleton height="30px" my="10px" />
                    <Skeleton height="30px" my="10px" />
                    <Skeleton height="30px" my="10px" />
                  </div>
                ) : (
                  <ButtonList
                    guardList={guards}
                    candyMachine={candyMachine}
                    candyGuard={candyGuard}
                    umi={umi}
                    ownedTokens={ownedTokens}
                    setGuardList={setGuards}
                    mintsCreated={mintsCreated}
                    setMintsCreated={setMintsCreated}
                    onOpen={onShowNftOpen}
                    setCheckEligibility={setCheckEligibility}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Featured NFTs */}
        <div className="max-w-[1200px] mx-auto mt-16 sm:mt-20">
          <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-center">
            Featured NFTs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {nftImages.map((image, index) => (
              <div key={index} className="group">
                <div className="p-1 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="relative rounded-lg overflow-hidden bg-[#14143A]">
                    <img
                      src={image}
                      alt={`Brokie #${index + 1}`}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-[#14143A] to-transparent">
                      <div className="text-sm font-medium">
                        Brokie #{index + 1}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Modal isOpen={isShowNftOpen} onClose={onShowNftClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Your minted NFT:</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ShowNft nfts={mintsCreated} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Page;
