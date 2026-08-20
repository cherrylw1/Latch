import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#141512",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 22,
            display: "flex",
            border: "2px solid #30322b",
            borderRadius: 116,
            background: "linear-gradient(145deg, #23251f 0%, #151612 62%, #0d0e0c 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 176,
            height: 280,
            left: 125,
            top: 102,
            display: "flex",
            border: "27px solid #fb7434",
            borderRadius: 34,
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.36)",
            transform: "skewY(-11deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 176,
            height: 280,
            right: 125,
            bottom: 102,
            display: "flex",
            border: "27px solid #fb7434",
            borderRadius: 34,
            background: "#161713",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.36)",
            transform: "skewY(-11deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 82,
            height: 7,
            left: 215,
            bottom: 74,
            display: "flex",
            borderRadius: 999,
            background: "#fb7434",
            opacity: 0.75,
          }}
        />
      </div>
    ),
    size,
  );
}
