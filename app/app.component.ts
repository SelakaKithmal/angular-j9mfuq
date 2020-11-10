import { State, process } from '@progress/kendo-data-query';
import { Component, Renderer2, NgZone, AfterViewInit, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { products } from './products';
import { Observable, Subscription, fromEvent } from 'rxjs';
import { tap, take } from 'rxjs/operators';

const tableRow = node => node.tagName.toLowerCase() === 'tr';

const closest = (node, predicate) => {
    while (node && !predicate(node)) {
        node = node.parentNode;
    }

    return node;
};

@Component({
    selector: 'my-app',
    template: `
        <kendo-grid
            [data]="gridData"
            [height]="350"
            [pageable]="true"
            [skip]="state.skip"
            [pageSize]="state.take"
            [rowClass]="rowCallback"
            (dataStateChange)="dataStateChange($event)">
            <kendo-grid-column field="ProductID" title="ID" width="40">
            </kendo-grid-column>
            <kendo-grid-column field="ProductName" title="Name" width="250">
            </kendo-grid-column>
            <kendo-grid-column field="Category.CategoryName" title="Category" width="300">
            </kendo-grid-column>
            <kendo-grid-column field="UnitPrice" title="Price" width="120">
            </kendo-grid-column>
            <kendo-grid-column field="UnitsInStock" title="In stock" width="120">
            </kendo-grid-column>
            <kendo-grid-column field="Discontinued" title="Discontinued" width="120">
                <ng-template kendoGridCellTemplate let-dataItem>
                    <input type="checkbox" [checked]="dataItem.Discontinued" disabled/>
                </ng-template>
            </kendo-grid-column>
        </kendo-grid>
    `,
    encapsulation: ViewEncapsulation.None,
    styles: [`
        .k-grid tr.dragging {
            background-color: #f45c42;
        };
    `]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
    public state: State = {
        skip: 0,
        take: 10
    };
    public gridData: any = process(products, this.state);
    private currentSubscription: Subscription;

    constructor(private renderer: Renderer2, private zone: NgZone) { }

    public ngAfterViewInit(): void {
        this.currentSubscription = this.handleDragAndDrop();
    }

    public ngOnDestroy(): void {
        this.currentSubscription.unsubscribe();
    }

    public dataStateChange(state: State): void {
        this.state = state;
        this.gridData = process(products, this.state);
        this.currentSubscription.unsubscribe();
        this.zone.onStable.pipe(take(1))
            .subscribe(() => this.currentSubscription = this.handleDragAndDrop());
    }

    public rowCallback(context: RowClassArgs) {
       return {
           dragging: context.dataItem.dragging
       };
   }

    private handleDragAndDrop(): Subscription {
        const sub = new Subscription(() => {});
        let draggedItemIndex;

        const tableRows = Array.from(document.querySelectorAll('.k-grid tr'));
        tableRows.forEach(item => {
            this.renderer.setAttribute(item, 'draggable', 'true');
            const dragStart = fromEvent<DragEvent>(item, 'dragstart');
            const dragOver = fromEvent(item, 'dragover');
            const dragEnd = fromEvent(item, 'dragend');

            sub.add(dragStart.pipe(
                tap(({ dataTransfer }) => {
                    try {
                      const dragImgEl = document.createElement('span');
                      dragImgEl.setAttribute('style', 'position: absolute; display: block; top: 0; left: 0; width: 0; height: 0;');
                      document.body.appendChild(dragImgEl);
                      dataTransfer.setDragImage(dragImgEl, 0, 0);
                    } catch (err) {
                      // IE doesn't support setDragImage
                    }
                    try {
                        // Firefox won't drag without setting data
                        dataTransfer.setData('application/json', {});
                    } catch (err) {
                        // IE doesn't support MIME types in setData
                    }
                })
            ).subscribe(({ target }) => {
                const row: HTMLTableRowElement = <HTMLTableRowElement>target;
                draggedItemIndex = row.rowIndex;
                const dataItem = this.gridData.data[draggedItemIndex];
                dataItem.dragging = true;
            }));

            sub.add(dragOver.subscribe((e: any) => {
                e.preventDefault();
                const dataItem = this.gridData.data.splice(draggedItemIndex, 1)[0];
                const dropIndex = closest(e.target, tableRow).rowIndex;
                const dropItem = this.gridData.data[dropIndex];

                draggedItemIndex = dropIndex;
                this.zone.run(() =>
                    this.gridData.data.splice(dropIndex, 0, dataItem)
                );
            }));

            sub.add(dragEnd.subscribe((e: any) => {
                e.preventDefault();
                const dataItem = this.gridData.data[draggedItemIndex];
                dataItem.dragging = false;
            }));
        });

        return sub;
    }
}
