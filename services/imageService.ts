
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const seed = Math.floor(Math.random() * 1000000000);
    
    const response = await fetch("https://mkai.nyc.mn/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "*/*"
      },
      body: JSON.stringify({
        prompt: prompt,
        model: "z-image-turbo",
        size: "1024x1024",
        steps: 9,
        apiKey: "WBPA8XXWG5SSQBE1IKL6HRZKA64C6EF0UVYGTPP5",
        seed: seed
      })
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    // Check Content-Type to decide how to handle the response
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      // If it returns a JSON
      const data = await response.json();
      if (data.url) return data.url;
      if (data.image) {
        // Handle base64 if present
        return data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
      }
      
      // If we got JSON but no known image field, it's likely an error or unexpected format.
      // We cannot read as blob anymore because stream is consumed.
      console.warn("Received JSON response without image url:", data);
      throw new Error("Received JSON response but could not identify image data.");
    }

    // Default: Assume the API returns the image binary directly (Blob) if not JSON
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Generate image error:", error);
    throw error;
  }
};