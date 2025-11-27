import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import welcomeHamsterGrey from "@assets/Welcome-Hamster-Grey.svg";

interface GuestRestrictionPopupProps {
  isOpen: boolean;
  type: 'archive' | 'personal' | 'pro';
  onClose: () => void;
  onRegister: () => void;
  onLogin: () => void;
  customTitle?: string;
  customText?: string;
}

export function GuestRestrictionPopup({
  isOpen,
  type,
  onClose,
  onRegister,
  onLogin,
  customTitle,
  customText,
}: GuestRestrictionPopupProps) {
  const content = customTitle && customText 
    ? {
        title: customTitle,
        text: customText
      }
    : type === 'archive' 
    ? {
        title: "Access the Elementle Archives",
        text: "Unlock years of history and track your progress as you uncover events you never knew happened."
      }
    : type === 'pro'
    ? {
        title: "Register your details to Go Pro!",
        text: "Register first and Hammie the hamster will generate personalised questions based on your location. You can then Go Pro to get rid of those pesky ads and personalise your questions!"
      }
    : {
        title: "Access your personalised games",
        text: "Hammie the hamster will generate personalised questions based on your location, mixed up with other interesting events he thinks you'll enjoy."
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex flex-col items-center justify-center p-4 z-[100]"
          style={{ backgroundColor: '#FAFAFA' }}
        >
          <div className="absolute top-4 left-4">
            <button
              onClick={onClose}
              className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
              data-testid="button-close-restriction-popup"
            >
              <ChevronLeft className="h-9 w-9 text-gray-700" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center max-w-md w-full space-y-8">
            <img
              src={welcomeHamsterGrey}
              alt="Hammie"
              className="h-40 w-auto object-contain"
              data-testid="img-restriction-hamster"
            />

            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-gray-800" data-testid="text-restriction-title">
                {content.title}
              </h2>
              <p className="text-base text-gray-600" data-testid="text-restriction-description">
                {content.text}
              </p>
            </div>

            <div className="flex flex-col w-full space-y-3 px-4">
              <Button
                onClick={onRegister}
                className="w-full h-14 text-lg font-bold rounded-full"
                style={{ backgroundColor: '#7DAAE8' }}
                data-testid="button-restriction-register"
              >
                Register
              </Button>
              <Button
                onClick={onLogin}
                variant="outline"
                className="w-full h-14 text-lg font-bold rounded-full border-2 border-gray-300"
                data-testid="button-restriction-login"
              >
                Login
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
