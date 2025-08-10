import YouTubeDownloader from "@/components/YouTubeDownloader";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 font-sans antialiased">
      <header className="container py-12">
        <div className="glass-panel rounded-2xl p-8 md:p-10 shadow-lg animate-fade-in">
          <p className="text-sm md:text-base text-muted-foreground">
            <span className="font-medium text-foreground">Fast</span>, <span className="font-medium text-foreground">simple</span>, serverless-ready
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-bold mt-3 tracking-tight leading-tight">
            YouTube <span className="text-primary">Video</span> & <span className="text-primary">Audio</span> Downloader
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Download <span className="font-medium text-foreground">MP4</span> or <span className="font-medium text-foreground">MP3</span> in high quality. Paste a link, pick a <span className="text-primary">format</span> and <span className="text-primary">quality</span>, and you’re set.
          </p>
        </div>
      </header>
      <main className="container pb-20">
        <YouTubeDownloader />
      </main>
    </div>
  );
};

export default Index;

