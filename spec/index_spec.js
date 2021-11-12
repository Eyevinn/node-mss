const { MSSParser } = require("../dist/index.js");
const fs = require("fs");

describe("Smooth Streaming parser", () => {
  it("can parse utf16 encoded manifest", (done) => {
    const parser = new MSSParser({ encoding: "utf16le" });
    parser.on("finish", () => {
      expect(parser.mss.header.isLive).toEqual(false);
      expect(parser.mss.streams.length).toEqual(2);
      done();
    });
    const stream = fs.createReadStream("./spec/testvectors/Manifest.utf16");
    stream.pipe(parser);
  });

  it("can parse utf8 encoded manifest", (done) => {
    const parser = new MSSParser();
    parser.on("finish", () => {
      expect(parser.mss.header.isLive).toEqual(true);
      expect(parser.mss.streams.length).toEqual(2);
      done();
    });
    const stream = fs.createReadStream("./spec/testvectors/Manifest.utf8");
    stream.pipe(parser);
  });
});