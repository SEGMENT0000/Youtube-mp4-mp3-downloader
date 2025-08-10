import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Link as LinkIcon,
  Music,
  Video as VideoIcon,
  Info,
} from "lucide-react";

type MediaType = "video" | "audio";

const DEFAULT_VIDEO_QUALITIES = ["1080p", "720p", "480p", "360p"] as const;
const DEFAULT_AUDIO_QUALITIES = ["128kbps"] as const;

interface VideoInfo {
  title: string;
  thumbnail_url: string;
  author_name?: string;
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // Shorts or embed
      const parts = u.pathname.split("/").filter(Boolean);
      const maybeId = parts[parts.length - 1];
      if (maybeId && maybeId.length >= 8) return maybeId;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchOEmbed(url: string): Promise<VideoInfo | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title: string;
      thumbnail_url: string;
      author_name?: string;
    };
    return data;
  } catch {
    return null;
  }
}

// Lightweight Piped API types and helpers
type PipedAudioStream = {
  url: string;
  format?: string;
  quality?: string;
  bitrate?: number | string;
};

type PipedVideoStream = {
  url: string;
  format?: string;
  quality?: string;
  videoOnly?: boolean;
};

type PipedResponse = {
  title?: string;
  thumbnailUrl?: string;
  audioStreams?: PipedAudioStream[];
  videoStreams?: PipedVideoStream[];
};

async function fetchPipedStreams(id: string): Promise<PipedResponse | null> {
  try {
    const res = await fetch(`https://piped.video/api/v1/streams/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as PipedResponse;
  } catch {
    return null;
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "download";
}

function parseBitrate(val?: number | string): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const m = String(val).match(/(\d+)\s*kbps/i);
  return m ? parseInt(m[1], 10) : parseInt(String(val), 10) || 0;
}

async function downloadBlob(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}


export default function YouTubeDownloader() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("video");
  const [quality, setQuality] = useState<string>(DEFAULT_VIDEO_QUALITIES[0]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isValid = useMemo(() => !!extractYouTubeId(url), [url]);

  useEffect(() => {
    // subtle signature interaction: glow follows cursor on the panel
    const el = panelRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--px", `${x}px`);
      el.style.setProperty("--py", `${y}px`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    // Reset quality when switching type
    setQuality(mediaType === "video" ? DEFAULT_VIDEO_QUALITIES[0] : DEFAULT_AUDIO_QUALITIES[0]);
  }, [mediaType]);

  const handleParse = async () => {
    if (!isValid) {
      toast({
        title: "Invalid URL",
        description: "Please paste a valid YouTube video link.",
        variant: "destructive",
      } as any);
      return;
    }
    setLoadingInfo(true);
    const data = await fetchOEmbed(url);
    setInfo(data);
    setLoadingInfo(false);
    if (!data) {
      toast({ title: "Couldn’t fetch details", description: "We’ll still try the download." } as any);
    }
  };

const handleDownload = async () => {
  if (!isValid) {
    toast({
      title: "Invalid URL",
      description: "Please paste a valid YouTube video link.",
      variant: "destructive",
    } as any);
    return;
  }

  const id = extractYouTubeId(url)!;
  toast({ title: "Preparing download", description: "Fetching available streams..." } as any);

  const streams = await fetchPipedStreams(id);

  if (!streams) {
    toast({
      title: "Unable to fetch streams",
      description: "The source may be temporarily unavailable.",
      variant: "destructive",
    } as any);
    return;
  }

  try {
    if (mediaType === "video") {
      const target = quality;
      const vids = streams.videoStreams || [];
      // Prefer mp4 with audio at selected quality
      let candidate =
        vids.find(v => (v.quality || "").includes(target) && (v.format || "").includes("mp4") && v.videoOnly === false) ||
        vids.find(v => (v.quality || "").includes(target) && v.videoOnly === false) ||
        vids.find(v => (v.format || "").includes("mp4") && v.videoOnly === false) ||
        vids.find(v => v.videoOnly === false) ||
        vids[0];

      if (!candidate?.url) {
        throw new Error("No suitable video stream found");
      }

      const ext = (candidate.format?.includes("mp4") ? "mp4" : (candidate.format || "mp4")).replace(/[^a-z0-9]/gi, "");
      const filename = `${sanitizeFilename(info?.title || id)}.${ext}`;
      const ok = await downloadBlob(candidate.url, filename);
      if (!ok) {
        window.open(candidate.url, "_blank", "noopener,noreferrer");
        toast({ title: "Opened stream", description: "Your browser will handle the download.", } as any);
      } else {
        toast({ title: "Download started", description: `${ext.toUpperCase()} • ${candidate.quality || ""}` } as any);
      }
    } else {
      const target = parseInt(quality.replace(/[^\d]/g, ""), 10) || 128;
      const auds = (streams.audioStreams || []).slice();
      // Sort by closeness to target bitrate, prefer m4a
      auds.sort((a, b) => {
        const da = Math.abs(parseBitrate(a.bitrate) - target);
        const db = Math.abs(parseBitrate(b.bitrate) - target);
        if (da !== db) return da - db;
        const am4a = (a.format || "").toLowerCase().includes("m4a") ? -1 : 0;
        const bm4a = (b.format || "").toLowerCase().includes("m4a") ? -1 : 0;
        return am4a - bm4a;
      });

      const candidate = auds[0];
      if (!candidate?.url) {
        throw new Error("No suitable audio stream found");
      }

      const extGuess = (candidate.format || "m4a").toLowerCase().includes("mp3") ? "mp3" : (candidate.format || "m4a");
      const ext = extGuess.replace(/[^a-z0-9]/gi, "");
      const filename = `${sanitizeFilename(info?.title || id)}.${ext}`;
      const ok = await downloadBlob(candidate.url, filename);
      if (!ok) {
        window.open(candidate.url, "_blank", "noopener,noreferrer");
        toast({ title: "Opened stream", description: "Your browser will handle the download.", } as any);
      } else {
        toast({ title: "Download started", description: `${ext.toUpperCase()} • ~${parseBitrate(candidate.bitrate)}kbps` } as any);
      }
    }
  } catch (e: any) {
    toast({
      title: "Download failed",
      description: e?.message || "Please try a different quality.",
      variant: "destructive",
    } as any);
  }
};

  const qualities = mediaType === "video" ? DEFAULT_VIDEO_QUALITIES : DEFAULT_AUDIO_QUALITIES;

  return (
    <div className="relative">
      <Card
        ref={panelRef}
        className="glass-panel max-w-2xl mx-auto overflow-hidden animate-fade-in"
        style={{
          backgroundImage:
            "radial-gradient(450px 160px at var(--px, 50%) var(--py, 10%), hsl(var(--ring) / 0.10), transparent 60%)",
        }}
      >
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-display">YouTube <span className="text-primary">Video</span> & <span className="text-primary">Audio</span> Downloader</CardTitle>
          <CardDescription>
            Paste a <span className="text-primary font-medium">YouTube</span> link, choose <span className="text-foreground font-medium">type</span> and <span className="text-foreground font-medium">quality</span>, then <span className="text-foreground font-medium">download</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="yt-url" className="flex items-center gap-2">
              <LinkIcon className="opacity-70" /> Video URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="yt-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleParse} className="shrink-0">
                <Info /> Details
              </Button>
            </div>
          </div>

          <Tabs value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="video" className="flex items-center gap-2">
                <VideoIcon /> Video (MP4)
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center gap-2">
                <Music /> Audio
              </TabsTrigger>
            </TabsList>
            <TabsContent value="video" className="mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quality</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {qualities.map((q) => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="audio" className="mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bitrate</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bitrate" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      {qualities.map((q) => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {info && (
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-start animate-fade-in">
              <div className="aspect-video rounded-lg overflow-hidden border border-border/50">
                <img
                  src={info.thumbnail_url}
                  alt={info.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Title</p>
                <p className="font-medium leading-snug">{info.title}</p>
                {info.author_name && (
                  <p className="text-sm text-muted-foreground">by {info.author_name}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Supports typical <span className="text-foreground font-medium">qualities</span>. Actual <span className="text-foreground">availability</span> depends on the video.
          </p>
          <Button variant="hero" size="lg" className="hover-scale" onClick={handleDownload}>
            <Download /> Download
          </Button>
        </CardFooter>
      </Card>

      {/* Subtle gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(800px 320px at 50% -10%, hsl(var(--ring) / 0.08), transparent 60%)",
        }}
      />
    </div>
  );
}
