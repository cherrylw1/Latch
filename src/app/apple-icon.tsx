import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#171813",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 8,
            display: "flex",
            border: "1px solid #30322b",
            borderRadius: 42,
            background: "linear-gradient(145deg, #23251f 0%, #151612 62%, #0d0e0c 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 62,
            height: 98,
            left: 43,
            top: 35,
            display: "flex",
            border: "10px solid #fb7434",
            borderRadius: 13,
            transform: "skewY(-11deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 62,
            height: 98,
            right: 43,
            bottom: 35,
            display: "flex",
            border: "10px solid #fb7434",
            borderRadius: 13,
            background: "#171813",
            transform: "skewY(-11deg)",
          }}
        />
      </div>
    ),
    size,
  );
}
