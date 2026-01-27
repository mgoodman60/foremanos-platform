'use client';

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Loader2, Box } from 'lucide-react';

// Autodesk Viewer Types
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface ViewerCamera {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  isPerspective: boolean;
}

interface ViewerBounds {
  min: Vector3;
  max: Vector3;
}

interface PropertyResult {
  dbId: number;
  name: string;
  externalId?: string;
  properties: Array<{
    displayName: string;
    displayValue: string | number;
    displayCategory: string;
    attributeName: string;
    type: number;
    units?: string;
    hidden: boolean;
    precision?: number;
  }>;
}

interface ViewerModel {
  getObjectTree(callback: (tree: ObjectTreeNode | null) => void): void;
  getInstanceTree(): InstanceTree | null;
  getData(): ModelData;
}

interface ObjectTreeNode {
  nodeId: number;
  name: string;
  children?: ObjectTreeNode[];
}

interface InstanceTree {
  getRootId(): number;
  getChildCount(dbId: number): number;
  enumNodeChildren(dbId: number, callback: (childId: number) => void, recursive?: boolean): void;
  getNodeName(dbId: number): string;
}

interface ModelData {
  urn: string;
  basePath: string;
}

interface ViewerSelectionEvent {
  dbIdArray: number[];
  fragIdsArray: number[];
  nodeArray: number[];
  model: ViewerModel;
  type: string;
  target: Autodesk.Viewing.GuiViewer3D;
}

interface ViewerEvent {
  type: string;
  target: Autodesk.Viewing.GuiViewer3D;
}

declare global {
  interface Window {
    Autodesk: typeof Autodesk;
  }
}

declare namespace Autodesk {
  namespace Viewing {
    class GuiViewer3D {
      constructor(container: HTMLElement, config?: object);
      start(): number;
      finish(): void;
      loadDocumentNode(document: Document, node: BubbleNode): Promise<ViewerModel>;
      setTheme(theme: string): void;
      fitToView(ids?: number[], model?: ViewerModel, immediate?: boolean): void;
      setGhosting(value: boolean): void;
      showAll(): void;
      hideAll(): void;
      isolate(ids?: number[]): void;
      getProperties(dbId: number, successCallback: (result: PropertyResult) => void, errorCallback?: (error: Error) => void): void;
      select(ids: number[]): void;
      clearSelection(): void;
      getSelection(): number[];
      search(text: string, onSuccess: (dbIds: number[]) => void, onError: (error: Error) => void, attributeNames?: string[]): void;
      getHiddenNodes(): number[];
      hide(dbIds: number[]): void;
      show(dbIds: number[]): void;
      setBackgroundColor(r: number, g: number, b: number, r2: number, g2: number, b2: number): void;
      addEventListener(event: string, callback: (e: ViewerSelectionEvent | ViewerEvent) => void): void;
      removeEventListener(event: string, callback: (e: ViewerSelectionEvent | ViewerEvent) => void): void;
      getExtension(id: string): Promise<object>;
      loadExtension(id: string, options?: object): Promise<object>;
      unloadExtension(id: string): boolean;
      model: ViewerModel;
      navigation: {
        setRequestTransitionWithUp(position: Vector3, target: Vector3, fov?: number, up?: Vector3, worldUp?: Vector3): void;
        getPosition(): Vector3;
        getTarget(): Vector3;
        getCamera(): ViewerCamera;
        setView(position: Vector3, target: Vector3): void;
        setVerticalFov(fov: number): void;
        getVerticalFov(): number;
        setPivotPoint(point: Vector3, lockPivot?: boolean, lockPan?: boolean): void;
        fitBounds(immediate: boolean, bounds: ViewerBounds): void;
      };
      impl: {
        setViewFromCamera(camera: ViewerCamera): void;
        invalidate(needsClear: boolean, needsRender?: boolean, overlayDirty?: boolean): void;
      };
      prefs: {
        set(name: string, value: string | number | boolean): void;
        get(name: string): string | number | boolean | undefined;
      };
      container: HTMLElement;
    }

    class Document {
      static load(urn: string, onSuccess: (doc: Document) => void, onError: (error: Error) => void, accessTokenFn: () => string): void;
      getRoot(): BubbleNode;
    }

    class BubbleNode {
      search(properties: { type: string; role?: string }): BubbleNode[];
      getDefaultGeometry(): BubbleNode;
      name(): string;
      children?: BubbleNode[];
    }

    const SELECTION_CHANGED_EVENT: string;
    const ISOLATE_EVENT: string;
    const SHOW_EVENT: string;
    const HIDE_EVENT: string;
    const GEOMETRY_LOADED_EVENT: string;
    const OBJECT_TREE_CREATED_EVENT: string;
    const MODEL_ROOT_LOADED_EVENT: string;

    function Initializer(options: object, callback: () => void): void;

    namespace Private {
      const Prefs: {
        GHOSTING: string;
        AMBIENT_SHADOWS: string;
        GROUND_SHADOW: string;
        GROUND_REFLECTION: string;
        ENV_MAP_BACKGROUND: string;
        SELECTION_MODE: string;
        RENDER_CACHE: string;
      };
    }
  }
}

export interface ViewerHandle {
  viewer: Autodesk.Viewing.GuiViewer3D | null;
  fitToView: (ids?: number[]) => void;
  isolate: (ids?: number[]) => void;
  showAll: () => void;
  select: (ids: number[]) => void;
  clearSelection: () => void;
  getSelection: () => number[];
  hide: (ids: number[]) => void;
  show: (ids: number[]) => void;
  search: (text: string) => Promise<number[]>;
  getProperties: (dbId: number) => Promise<PropertyResult>;
  setCamera: (position: Vector3, target: Vector3) => void;
  getCamera: () => { position: Vector3; target: Vector3 } | null;
  loadExtension: (id: string, options?: object) => Promise<object>;
  getExtension: (id: string) => Promise<object>;
  getModelTree: () => Promise<ObjectTreeNode>;
}

interface ForgeViewerEnhancedProps {
  urn: string;
  onViewerReady?: (viewer: Autodesk.Viewing.GuiViewer3D) => void;
  onSelectionChanged?: (ids: number[]) => void;
  onError?: (error: string) => void;
  className?: string;
  extensions?: string[];
}

const ForgeViewerEnhanced = forwardRef<ViewerHandle, ForgeViewerEnhancedProps>(
  ({ urn, onViewerReady, onSelectionChanged, onError, className = '', extensions = [] }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    // Expose viewer methods via ref
    useImperativeHandle(ref, () => ({
      viewer: viewerRef.current,
      fitToView: (ids?: number[]) => viewerRef.current?.fitToView(ids),
      isolate: (ids?: number[]) => viewerRef.current?.isolate(ids),
      showAll: () => viewerRef.current?.showAll(),
      select: (ids: number[]) => viewerRef.current?.select(ids),
      clearSelection: () => viewerRef.current?.clearSelection(),
      getSelection: () => viewerRef.current?.getSelection() || [],
      hide: (ids: number[]) => viewerRef.current?.hide(ids),
      show: (ids: number[]) => viewerRef.current?.show(ids),
      search: (text: string) => new Promise((resolve, reject) => {
        viewerRef.current?.search(text, resolve, reject);
      }),
      getProperties: (dbId: number) => new Promise((resolve, reject) => {
        viewerRef.current?.getProperties(dbId, resolve, reject);
      }),
      setCamera: (position: Vector3, target: Vector3) => {
        viewerRef.current?.navigation.setView(position, target);
      },
      getCamera: () => {
        if (!viewerRef.current) return null;
        return {
          position: viewerRef.current.navigation.getPosition(),
          target: viewerRef.current.navigation.getTarget(),
        };
      },
      loadExtension: (id: string, options?: object) => viewerRef.current?.loadExtension(id, options) || Promise.reject('No viewer'),
      getExtension: (id: string) => viewerRef.current?.getExtension(id) || Promise.reject('No viewer'),
      getModelTree: () => new Promise((resolve, reject) => {
        if (!viewerRef.current?.model) return reject('No model loaded');
        viewerRef.current.model.getObjectTree((tree) => {
          if (tree) resolve(tree);
          else reject('Failed to get object tree');
        });
      }),
    }));

    // Fetch access token
    const fetchToken = useCallback(async () => {
      try {
        const response = await fetch('/api/autodesk/token');
        if (!response.ok) throw new Error('Failed to get viewer token');
        const data = await response.json();
        return data.access_token;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Token fetch failed';
        setError(message);
        onError?.(message);
        return null;
      }
    }, [onError]);

    // Load Autodesk Viewer scripts
    useEffect(() => {
      const loadViewerScripts = async () => {
        if (window.Autodesk?.Viewing) return true;

        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
        document.head.appendChild(css);

        return new Promise<boolean>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
        });
      };

      loadViewerScripts();
    }, []);

    // Initialize viewer
    useEffect(() => {
      if (!urn || !containerRef.current) return;

      let viewer: Autodesk.Viewing.GuiViewer3D | null = null;
      let mounted = true;

      const initViewer = async () => {
        const token = await fetchToken();
        if (!token || !mounted) return;

        let attempts = 0;
        while (!window.Autodesk?.Viewing && attempts < 50) {
          await new Promise(r => setTimeout(r, 100));
          attempts++;
        }

        if (!window.Autodesk?.Viewing) {
          setError('Failed to load Autodesk Viewer SDK');
          setLoading(false);
          return;
        }

        const options = {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
          getAccessToken: (callback: (token: string, expires: number) => void) => {
            callback(token, 3600);
          },
        };

        window.Autodesk.Viewing.Initializer(options, async () => {
          if (!mounted || !containerRef.current) return;

          viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {
            extensions: [
              'Autodesk.Viewing.MarkupsCore',
              'Autodesk.Viewing.MarkupsGui',
              ...extensions,
            ],
          });
          viewerRef.current = viewer;

          const startedCode = viewer.start();
          if (startedCode > 0) {
            setError('Failed to initialize viewer');
            setLoading(false);
            return;
          }

          viewer.setTheme('dark-theme');
          viewer.setBackgroundColor(22, 27, 34, 22, 27, 34);

          // Selection change handler
          viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
            const selectionEvent = e as ViewerSelectionEvent;
            onSelectionChanged?.(selectionEvent.dbIdArray || []);
          });

          const documentId = `urn:${urn}`;
          window.Autodesk.Viewing.Document.load(
            documentId,
            async (doc) => {
              if (!viewer || !mounted) return;

              const viewables = doc.getRoot().getDefaultGeometry();
              await viewer.loadDocumentNode(doc, viewables);
              
              if (!mounted) return;
              
              // Load common extensions
              try {
                await viewer.loadExtension('Autodesk.Section');
                await viewer.loadExtension('Autodesk.Measure');
              } catch (e) {
                console.warn('[ForgeViewer] Extension load warning:', e);
              }
              
              setLoading(false);
              setProgress(100);
              onViewerReady?.(viewer);
            },
            (errorCode) => {
              console.error('[ForgeViewer] Document load error:', errorCode);
              setError(`Failed to load model (Error: ${errorCode})`);
              setLoading(false);
            },
            () => token
          );
        });
      };

      initViewer();

      return () => {
        mounted = false;
        if (viewer) {
          viewer.finish();
          viewerRef.current = null;
        }
      };
    }, [urn, fetchToken, onViewerReady, onSelectionChanged, extensions]);

    if (error) {
      return (
        <div className={`flex items-center justify-center bg-gray-900 text-white rounded-lg p-8 ${className}`}>
          <div className="text-center">
            <Box className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-400 font-medium">{error}</p>
            <p className="text-gray-400 text-sm mt-2">Please try refreshing the page</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        <div ref={containerRef} className="w-full h-full min-h-[400px]" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
              <p className="text-white mt-4">Loading 3D Model...</p>
              <div className="w-48 h-1.5 bg-gray-700 rounded-full mt-3 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ForgeViewerEnhanced.displayName = 'ForgeViewerEnhanced';

export default ForgeViewerEnhanced;
