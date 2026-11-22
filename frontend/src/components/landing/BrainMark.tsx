import brainImage from '../../assets/Brain.webp'

export default function BrainMark({ className }: { className: string }) {
  return (
    <img
      src={brainImage}
      alt=""
      className={`object-contain scale-140 drop-shadow-md transition-transform ${className}`}
    />
  )
}
