import brainImage from '../../assets/Brain.png'

export default function BrainMark({ className }: { className: string }) {
  return (
    <img
      src={brainImage}
      alt="Research Brain"
      className={`object-contain scale-140 drop-shadow-md transition-transform ${className}`}
    />
  )
}
