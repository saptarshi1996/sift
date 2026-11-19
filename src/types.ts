export type Kind = 'video' | 'thumbnail'

export interface VideoMedia {
  url: string
  /** Resolution parsed from the encode tag (e.g. 720). 0 when unknown. */
  res: number
}

export interface ThumbMedia {
  url: string
  width?: number
  height?: number
}

/** One story slide: its best video (if any) and its largest picture. */
export interface Slide {
  item: number
  type: 'video' | 'image'
  video: VideoMedia | null
  thumbnail: ThumbMedia | null
}
