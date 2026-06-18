import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListKolCharacters,
  useListKolPosts,
  useGenerateKolPost,
  type KolCharacter,
  type KolPost,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Users, Wand2, Volume2 } from "lucide-react";

export default function VirtualKolPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: characters } = useListKolCharacters();
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");

  const generateMutation = useGenerateKolPost();
  const { data: posts, isLoading } = useListKolPosts(
    characterId ? { characterId } : undefined,
  );

  const refresh = () => queryClient.invalidateQueries();

  const generate = () => {
    if (!characterId || !topic.trim()) {
      toast({ title: "Chọn nhân vật và nhập chủ đề", variant: "destructive" });
      return;
    }
    generateMutation.mutate(
      { data: { characterId, topic: topic.trim() } },
      {
        onSuccess: (res) => {
          const v = (res as { voice?: { active?: boolean } } | undefined)?.voice;
          toast({
            title: "Đã tạo KOL post",
            description: v?.active ? "Kèm giọng nói" : "Giọng nói cần ElevenLabs key",
          });
          setTopic("");
          refresh();
        },
        onError: () => toast({ title: "Lỗi tạo post", variant: "destructive" }),
      },
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Virtual KOL</h1>
            <p className="text-sm text-muted-foreground">
              3 nhân vật AI. Mọi post tự gắn nhãn #KICharakter (tuân thủ EU AI Act). TTS/video cần key.
            </p>
          </div>
        </div>

        {/* Characters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(characters ?? []).map((c: KolCharacter) => (
            <Card
              key={c.id}
              className={`p-4 cursor-pointer transition ${characterId === c.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setCharacterId(c.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.name}</span>
                {c.active && <Badge className="bg-green-100 text-green-800">active</Badge>}
              </div>
              <p className="text-xs text-primary">{c.handle}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.personality}</p>
            </Card>
          ))}
        </div>

        {/* Generate */}
        <Card className="p-5 space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label className="text-xs">Chủ đề cho {characterId ? characters?.find((c) => c.id === characterId)?.name : "nhân vật"}</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="VD: Recipe Phở cho mùa đông" />
            </div>
            <Button onClick={generate} disabled={generateMutation.isPending || !characterId}>
              <Wand2 className="w-4 h-4 mr-1.5" />
              {generateMutation.isPending ? "Đang tạo..." : "Tạo post"}
            </Button>
          </div>
        </Card>

        {/* Posts */}
        {!characterId ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Chọn 1 nhân vật để xem post.</Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !posts || posts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Chưa có post. Tạo post đầu tiên ở trên.</Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p: KolPost) => (
              <Card key={p.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{p.status}</Badge>
                  {p.audioUrl ? (
                    <Badge className="bg-blue-100 text-blue-800 gap-1"><Volume2 className="w-3 h-3" /> audio</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">chưa có audio (cần key)</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString("de-DE")}</span>
                </div>
                {p.script && <p className="text-sm whitespace-pre-wrap"><strong>Script:</strong> {p.script}</p>}
                {p.caption && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{p.caption}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
