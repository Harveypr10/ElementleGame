import happyHamster from "@assets/generated_images/Celebrating_hamster_transparent_c10effe4.png";

export function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-200 to-blue-100 dark:from-blue-900 dark:to-blue-800">
      <h1 className="text-6xl font-bold text-foreground mb-16">
        Elementle
      </h1>
      <img
        src={happyHamster}
        alt="Happy Hamster"
        className="w-48 h-48 object-contain"
      />
    </div>
  );
}
