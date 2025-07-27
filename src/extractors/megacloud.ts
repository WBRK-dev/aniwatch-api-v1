import axios from "axios";
import crypto from "crypto";
import createHttpError from "http-errors";
import { getSources } from "./lib/rabbit.js";
import * as cheerio from "cheerio";

// https://megacloud.tv/embed-2/e-1/dBqCr5BcOhnD?k=1

const megacloud = {
  script: "https://megacloud.tv/js/player/a/prod/e1-player.min.js?v=",
  sources: "https://megacloud.tv/embed-2/ajax/e-1/getSources?id=",
} as const;

type track = {
  file: string;
  kind: string;
  label?: string;
  default?: boolean;
};

type intro_outro = {
  start: number;
  end: number;
};

type unencryptedSrc = {
  file: string;
  type: string;
};

type extractedSrc = {
  sources: string | unencryptedSrc[];
  tracks: track[];
  encrypted: boolean;
  intro: intro_outro;
  outro: intro_outro;
  server: number;
};

interface ExtractedData
  extends Pick<extractedSrc, "intro" | "outro" | "tracks"> {
  sources: { file: string; type: string }[];
}

class MegaCloud {
  private serverName = "megacloud";

  async extract(videoUrl: URL) {
    try {
      const extractedData: ExtractedData = {
        tracks: [],
        intro: {
          start: 0,
          end: 0,
        },
        outro: {
          start: 0,
          end: 0,
        },
        sources: [],
      };

      const videoId = videoUrl?.href?.split("/")?.pop()?.split("?")[0];
      
      // @ts-ignore
      return await getSources(videoId);
    } catch (err) {
      // console.log(err);
      throw err;
    }
  }

  extractVariables(text: string) {
    // copied from github issue #30 'https://github.com/ghoshRitesh12/aniwatch-api/issues/30'
    const regex =
      /case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);/g;
    const matches = text.matchAll(regex);
    const vars = Array.from(matches, (match) => {
      const matchKey1 = this.matchingKey(match[1], text);
      const matchKey2 = this.matchingKey(match[2], text);
      try {
        return [parseInt(matchKey1, 16), parseInt(matchKey2, 16)];
      } catch (e) {
        return [];
      }
    }).filter((pair) => pair.length > 0);

    return vars;
  }

  getSecret(encryptedString: string, values: number[][]) {
    let secret = "",
      encryptedSource = "",
      encryptedSourceArray = encryptedString.split(""),
      currentIndex = 0;

    for (const index of values) {
      const start = index[0] + currentIndex;
      const end = start + index[1];

      for (let i = start; i < end; i++) {
        secret += encryptedString[i];
        encryptedSourceArray[i] = "";
      }
      currentIndex += index[1];
    }

    encryptedSource = encryptedSourceArray.join("");

    return { secret, encryptedSource };
  }

  decrypt(encrypted: string, keyOrSecret: string, maybe_iv?: string) {
    let key;
    let iv;
    let contents;
    if (maybe_iv) {
      key = keyOrSecret;
      iv = maybe_iv;
      contents = encrypted;
    } else {
      // copied from 'https://github.com/brix/crypto-js/issues/468'
      const cypher = Buffer.from(encrypted, "base64");
      const salt = cypher.subarray(8, 16);
      const password = Buffer.concat([
        Buffer.from(keyOrSecret, "binary"),
        salt,
      ]);
      const md5Hashes = [];
      let digest = password;
      for (let i = 0; i < 3; i++) {
        md5Hashes[i] = crypto.createHash("md5").update(digest).digest();
        digest = Buffer.concat([md5Hashes[i], password]);
      }
      key = Buffer.concat([md5Hashes[0], md5Hashes[1]]);
      iv = md5Hashes[2];
      contents = cypher.subarray(16);
    }

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted =
      decipher.update(
        contents as any,
        typeof contents === "string" ? "base64" : undefined,
        "utf8"
      ) + decipher.final();

    return decrypted;
  }

  // function copied from github issue #30 'https://github.com/ghoshRitesh12/aniwatch-api/issues/30'
  matchingKey(value: string, script: string) {
    const regex = new RegExp(`,${value}=((?:0x)?([0-9a-fA-F]+))`);
    const match = script.match(regex);
    if (match) {
      return match[1].replace(/^0x/, "");
    } else {
      throw new Error("Failed to match the key");
    }
  }

  async extract2(episodeId: string, category: "sub" | "dub" | "raw"): Promise<ExtractedData> {
    const extractedData: ExtractedData = {
        tracks: [],
        intro: {
            start: 0,
            end: 0,
        },
        outro: {
            start: 0,
            end: 0,
        },
        sources: [],
    };

    const epId = episodeId.split("?ep=")[1];

    const iframe = await fetch(`https://megaplay.buzz/stream/s-2/${epId}/${category}`, {
        headers: {
            "Host": "megaplay.buzz",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "DNT": "1",
            "Sec-GPC": "1",
            "Connection": "keep-alive",
            "Referer": "https://megaplay.buzz/api",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "iframe",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            "Priority": "u=4",
            "TE": "trailers"
        }
    });
    if (!iframe.ok) throw new Error("Episode is not available");

    const iframeBody = await iframe.text();

    const $ = cheerio.load(iframeBody);

    const id = $("#megaplay-player").attr("data-id");

    const sources = await fetch(`https://megaplay.buzz/stream/getSources?id=${id}&id=${id}`, {
        headers: {
            "Host": "megaplay.buzz",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "X-Requested-With": "XMLHttpRequest",
            "DNT": "1",
            "Sec-GPC": "1",
            "Connection": "keep-alive",
            "Referer": "https://megaplay.buzz/stream/s-2/141679/sub",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "TE": "trailers"
        }
    });

    const sourcesJson: any = await sources.json();

    extractedData.intro = sourcesJson.intro;
    extractedData.outro = sourcesJson.outro;
    extractedData.tracks = sourcesJson.tracks;
    extractedData.sources = [{
        file: sourcesJson.sources.file,
        type: 'hls'
    }];

    return extractedData;
  }
}

export default MegaCloud;
