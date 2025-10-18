import { useEffect, useRef, useState } from "react";
import hamsterVideo from "@assets/generated_images/hamster-welcome.mp4";
import { WelcomePage } from "./WelcomePage";

interface SplashScreenProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function SplashScreen({ onLogin, onSignup }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => setFinished(true);
    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, []);

  if (finished) {
    return <WelcomePage onLogin={onLogin} onSignup={onSignup} />;
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center 
                 bg-gradient-to-b from-[#DFE1CE] to-[#DFE1CE] overflow-hidden"
    >
      {/* Overlay heading */}
      <h1 className="absolute top-8 w-full text-center text-3xl md:text-4xl font-bold z-10 text-gray-800 drop-shadow">
        Welcome to Elementle
      </h1>

      {/* Full video with stronger responsive zoom */}
      <video
        ref={videoRef}
        src={hamsterVideo}
        autoPlay
        muted
        playsInline
        className="
          w-full h-full object-cover
          scale-125           /* default: zoomed in for phones */
          sm:scale-125        /* keep zoom on small screens */
          md:scale-110        /* reduce zoom on tablets */
          lg:scale-100        /* normal size on desktops */
          transition-transform
        "
      />
    </div>
  );
}
