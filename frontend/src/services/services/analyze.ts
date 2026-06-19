import axios from "axios";

export async function analyzeMessage(message: string) {
  const response = await axios.post(
    "http://localhost:5000/analyze",
    {
      message,
    }
  );

  return response.data;
}