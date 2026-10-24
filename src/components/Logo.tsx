export default function Logo({ size = 40 }: { size?: number }) {
  return <img src="./icons/app.svg" width={size} height={size} alt="Pazulic" style={{ borderRadius: size * 0.22, display: "block" }} />;
}
