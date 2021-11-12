import { Writable } from "stream";
import XMLParser from "fast-xml-parser";
import Debug from "debug";
import { StringDecoder } from "string_decoder";

const debug = Debug("mss-parser");

interface MSSHeader {
  version: string;
  timescale: number;
  duration: number;
  isLive: boolean;
  dvrWindowLength: number;
  lookAheadFragmentCount: number;
}

interface MSSQualityLevel {
  index: string;
  bitrate: number;
  fourCC: string;
  maxWidth: number;
  maxHeight: number;
  audioTag: string;
  channels: number;
  samplingRate: number;
  bitsPerSample: number;
  packetSize: number;
  codec: string;
}

interface MSSStream {
  type: string;
  name: string;
  subType: string;
  chunks: number;
  maxWidth: number;
  maxHeight: number;
  displayWidth: number;
  displayHeight: number;
  url: string;
  chunkList: any[];
  qualityLevels: MSSQualityLevel[];
}

export class MSS {
  private headerObj: MSSHeader;
  private streamsList: MSSStream[];

  constructor(jsonObj) {
    this.headerObj = {
      version: jsonObj["SmoothStreamingMedia"][0]["@_MajorVersion"] + "." + jsonObj["SmoothStreamingMedia"][0]["@_MinorVersion"],
      timescale: parseInt(jsonObj["SmoothStreamingMedia"][0]["@_TimeScale"], 10),
      duration: parseInt(jsonObj["SmoothStreamingMedia"][0]["@_Duration"], 10),
      isLive: jsonObj["SmoothStreamingMedia"][0]["@_IsLive"] === "TRUE",
      dvrWindowLength: parseInt(jsonObj["SmoothStreamingMedia"][0]["@_DVRWindowLength"], 10),
      lookAheadFragmentCount: parseInt(jsonObj["SmoothStreamingMedia"][0]["@_LookAheadFragmentCount"], 10)
    };
    this.streamsList = jsonObj["SmoothStreamingMedia"][0].StreamIndex.map(streamJson => {
      const levels: MSSQualityLevel[] = streamJson["QualityLevel"].map(l => {
        return {
          index: l["@_Index"],
          bitrate: parseInt(l["@_Bitrate"], 10),
          fourCC: l["@_FourCC"],
          maxWidth: parseInt(l["@_MaxWidth"], 10) || undefined,
          maxHeight: parseInt(l["@_MaxHeight"], 10) || undefined,
          audioTag: l["@_AudioTag"],
          channels: parseInt(l["@_Channels"], 10) || undefined,
          samplingRate: parseInt(l["@_SamplingRate"], 10) || undefined,
          bitsPerSample: parseInt(l["@_BitsPerSample"], 10) || undefined,
          packetSize: parseInt(l["@_PacketSize"], 10) || undefined,
          codec: this.parseCodePrivateData(l["@_FourCC"], l["@_CodecPrivateData"]),
        };
      });
      return {
        type: streamJson["@_Type"],
        name: streamJson["@_Name"],
        subType: streamJson["@_Subtype"],
        chunks: parseInt(streamJson["@_Chunks"], 10),
        maxWidth: parseInt(streamJson["@_MaxWidth"], 10) || undefined,
        maxHeight: parseInt(streamJson["@_MaxHeight"], 10) || undefined,
        displayWidth: parseInt(streamJson["@_DisplayWidth"], 10) || undefined,
        displayHeight: parseInt(streamJson["@_DisplayHeight"], 10) || undefined,
        url: streamJson["@_Url"],
        chunkList: [],
        qualityLevels: levels
      };
    });
  }

  private parseCodePrivateData(fourCC: string, codecPrivateData: string) {
    if (fourCC === "H264") {
      // => Find the SPS nal header
      const nalHeader = /00000001[0-9]7/.exec(codecPrivateData);
      // => Find the 6 characters after the SPS nalHeader (if it exists)
      const avctoi = nalHeader && nalHeader[0] ? (codecPrivateData.substr(codecPrivateData.indexOf(nalHeader[0]) + 10, 6)) : undefined;

      return "avc1." + avctoi;
    } else if (/^AAC/.exec(fourCC)) {
      const objectType = (parseInt(codecPrivateData.substr(0, 2), 16) & 0xF8) >> 3;
      return "mp4a.40." + objectType;
    }
  }

  get header(): MSSHeader {
    return this.headerObj;
  }

  get streams(): MSSStream[] {
    return this.streamsList;
  }
}

export class MSSParser extends Writable {
  private stringBuffer: string;
  private mssJsonObj: any;
  private mssObj: MSS;
  private encoding: BufferEncoding;

  constructor(opts) {
    super();
    this.encoding = (opts && opts.encoding) || "utf8";
    this.stringBuffer = "";
  }

  _write(chunk: any, encoding: string, next: (error?: Error) => void) {
    const decoder = new StringDecoder(this.encoding);
    const cent = Buffer.from(chunk);
    this.stringBuffer += decoder.write(cent);
    next();
  }

  _final(next: (error?: Error) => void){
    debug(this.stringBuffer);
    this.mssJsonObj = XMLParser.parse(this.stringBuffer, {
      ignoreAttributes: false,
      arrayMode: true,
    });
    debug(this.mssJsonObj);
    this.mssObj = new MSS(this.mssJsonObj);
    next();
  }

  get mss() {
    return this.mssObj;
  }

  toString() {
    return this.stringBuffer;
  }
}