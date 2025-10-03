# API Specification (OpenAPI 3.0)

```yaml
openapi: 3.0.0
info:
  title: Kefken Ahşap Dekorasyon API
  version: 1.0.0
paths:
  /api/projects:
    get:
      summary: Get all projects
      responses:
        '200':
          description: A list of projects
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Project'
    post:
      summary: Create a new project
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectInput'
      responses:
        '201':
          description: Project created successfully
  /api/projects/{id}:
    get:
      summary: Get a single project by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: A single project
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
    put:
      summary: Update an existing project
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectInput'
      responses:
        '200':
          description: Project updated successfully
    delete:
      summary: Delete a project
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Project deleted successfully
  /api/upload:
    post:
      summary: Upload an image
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                image: 
                  type: string
                  format: binary
                watermark:
                  type: boolean
      responses:
        '200':
          description: Image uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  url: 
                    type: string

components:
  schemas:
    Project:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        story:
          type: string
        client:
          type: string
        location:
          type: string
        services:
          type: array
          items:
            type: string
        tags:
          type: array
          items:
            type: string
        metaTitle:
          type: string
        metaDescription:
          type: string
        images:
          type: array
          items:
            type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
    ProjectInput:
      type: object
      properties:
        title:
          type: string
        story:
          type: string
        client:
          type: string
        location:
          type: string
        services:
          type: array
          items:
            type: string
        tags:
          type: array
          items:
            type: string
        metaTitle:
          type: string
        metaDescription:
          type: string
        images:
          type: array
          items:
            type: string
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Watermarking Logic

The watermarking logic will be handled by the `/api/upload` endpoint. When an image is uploaded with the `watermark` flag set to `true`, the server will use the `sharp` library to add a watermark to the image before saving it to Supabase Storage. The watermark will be a semi-transparent overlay of the company logo.
