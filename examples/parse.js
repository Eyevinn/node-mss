const { MSSParser } = require("../dist/index.js");
const fetch = require("node-fetch");

const parse = async (url, encoding) => {
  const parser = new MSSParser({ encoding });
  parser.on("finish", () => {
    console.log("Microsoft Smooth Streaming " + parser.mss.header.version + `, live=${parser.mss.header.isLive}`);
    parser.mss.streams.map(stream => {
      console.log(stream.type.toUpperCase() + ":");
      console.log("   url: " + stream.url);
      if (stream.type === "video") {
        stream.qualityLevels.map(l => {
          console.log(`   - [${l.index}]/${l.bitrate} ${l.maxWidth}:${l.maxHeight} (${l.codec})`);
        });
      } else if (stream.type === "audio") {
        stream.qualityLevels.map(l => {
          console.log(`   - [${l.index}]/${l.bitrate} ${l.channels}ch, ${l.bitsPerSample}bit ${l.samplingRate}Hz (${l.codec})`);
        });
      } else {
        console.log("UNKNOWN");
      }
    });
  });

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`unexpected response ${res.statusText}`);
  } else {
    res.body.pipe(parser);
  }
}

parse("http://playready.directtaps.net/smoothstreaming/SSWSS720H264/SuperSpeedway_720.ism/Manifest", "utf16le");